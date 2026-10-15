import { z } from "zod";
import type { Logger } from "@vitalos/observability";
import { clientIpFromHeaders } from "@vitalos/security/rate-limit";
import type { RateLimiter } from "@vitalos/security/rate-limit";
import { ContentRejectedError, ContentUnavailableError } from "../client";
import type { ContentClient } from "../client";
import { correlationIdFrom, json, rateLimitedFor, readBodyWithLimit } from "../http/guards";
import { isJsonContentType, isSameOrigin } from "../../enquiries/http/request-guards";
import type { RenderResult } from "../markdown/render";
import type { ContentReaders } from "../readers";
import {
  ApplicationAccepted,
  ApplicationErrors,
  ApplicationRequest,
  UploadTicket,
  UploadTicketRequest,
  cvMimeTypes,
} from "../schemas";
import { CV_MAX_BYTES, validateApplication } from "./form";

/**
 * The website side of the A9 application flow. Both routes are same-origin JSON endpoints called
 * by the role page's form; they verify, rate-limit and validate, then forward to the admin signed
 * with scope `submit`. The browser uploads the CV directly to the ticket's URL, never through
 * the website. Responses are `{ errors: { field: code } }` in the contract's codes, or
 * `{ error: "unavailable" }` (503); nothing submitted is ever echoed or logged.
 */

export type HumanCheck = "passed" | "failed" | "disabled" | "unavailable";

export interface CareersDeps {
  /** Null when the content API or the submit key is not configured. */
  client: Pick<ContentClient, "post"> | null;
  limiter: RateLimiter;
  siteOrigin: string;
  verifyHuman(token: string, ip: string | undefined): Promise<HumanCheck>;
  readers: Pick<ContentReaders, "role">;
  renderProcess(markdown: string): Promise<RenderResult>;
  logger?: Pick<Logger, "info" | "warn">;
}

const MAX_UPLOAD_BODY = 4 * 1024;
const MAX_APPLICATION_BODY = 24 * 1024;

const errorsBody = (errors: Record<string, string>) => ({ errors });

function guard(request: Request, deps: CareersDeps, correlationId: string): Response | null {
  if (!isSameOrigin(request.headers, deps.siteOrigin)) {
    return json({ error: "forbidden" }, 403, correlationId);
  }
  if (!isJsonContentType(request.headers)) {
    return json({ error: "unsupported_media_type" }, 415, correlationId);
  }
  return null;
}

async function readJson(
  request: Request,
  limit: number,
  correlationId: string,
): Promise<{ value: unknown } | { response: Response }> {
  const body = await readBodyWithLimit(request, limit);
  if (!body.ok) {
    return {
      response:
        body.reason === "too-large"
          ? json({ error: "payload_too_large" }, 413, correlationId)
          : json(errorsBody({ body: "invalid" }), 400, correlationId),
    };
  }
  try {
    return { value: JSON.parse(body.text) as unknown };
  } catch {
    return { response: json(errorsBody({ body: "invalid" }), 400, correlationId) };
  }
}

/** Keeps only `{ field: code }` pairs the contract defines (never echoes anything else). */
function rejected(error: ContentRejectedError, correlationId: string): Response {
  const parsed = ApplicationErrors.safeParse(error.body);
  const status = [400, 409, 422, 429].includes(error.status) ? error.status : 400;
  return json(
    parsed.success ? parsed.data : errorsBody({ body: "invalid" }),
    status,
    correlationId,
  );
}

const UploadBody = z.strictObject({
  roleSlug: z.string().max(80),
  filename: z.string().max(200),
  size: z.number(),
  mime: z.string().max(120),
  turnstileToken: z.string().max(4096),
  website: z.string().max(200).exactOptional(),
});

/** `POST /api/careers/uploads`: Turnstile, 5 an hour per IP, then a signed upload ticket. */
export async function handleUploadRequest(request: Request, deps: CareersDeps): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);
  const blocked = guard(request, deps, correlationId);
  if (blocked) return blocked;
  const limited = await rateLimitedFor(
    deps.limiter,
    request.headers,
    "careers-upload",
    correlationId,
    {
      errors: { uploadId: "rate_limited" },
    },
  );
  if (limited) return limited;
  if (!deps.client) return json({ error: "unavailable" }, 503, correlationId);

  const read = await readJson(request, MAX_UPLOAD_BODY, correlationId);
  if ("response" in read) return read.response;
  const body = UploadBody.safeParse(read.value);
  if (!body.success) return json(errorsBody({ body: "invalid" }), 400, correlationId);
  if (body.data.website) return json({ error: "rejected" }, 403, correlationId);

  const { turnstileToken } = body.data;
  const ticketRequest = {
    roleSlug: body.data.roleSlug,
    filename: body.data.filename,
    size: body.data.size,
    mime: body.data.mime,
  };
  const errors: Record<string, string> = {};
  if (!(cvMimeTypes as readonly string[]).includes(ticketRequest.mime))
    errors["mime"] = "upload_type";
  if (!Number.isSafeInteger(ticketRequest.size) || ticketRequest.size < 1)
    errors["size"] = "invalid";
  else if (ticketRequest.size > CV_MAX_BYTES) errors["size"] = "upload_size";
  const valid = UploadTicketRequest.safeParse(ticketRequest);
  if (!valid.success && Object.keys(errors).length === 0) errors["filename"] = "invalid";
  if (Object.keys(errors).length > 0 || !valid.success) {
    return json(errorsBody(errors), 400, correlationId);
  }

  const human = await deps.verifyHuman(turnstileToken, clientIpFromHeaders(request.headers));
  if (human === "unavailable") return json({ error: "unavailable" }, 503, correlationId);
  if (human === "failed") return json(errorsBody({ turnstile: "invalid" }), 403, correlationId);

  try {
    const ticket = await deps.client.post(
      "/api/careers/v1/upload-tickets",
      valid.data,
      UploadTicket,
      {
        scope: "submit",
        errorSchema: ApplicationErrors,
      },
    );
    deps.logger?.info("careers.upload_ticket", { correlationId, uploadId: ticket.uploadId });
    return json(ticket, 200, correlationId);
  } catch (error) {
    if (error instanceof ContentRejectedError) {
      deps.logger?.info("careers.upload_refused", { correlationId, status: error.status });
      return rejected(error, correlationId);
    }
    if (error instanceof ContentUnavailableError) {
      deps.logger?.warn("careers.upload_unavailable", { correlationId, code: error.code });
      return json({ error: "unavailable" }, 503, correlationId);
    }
    throw error;
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max * 4)
    .exactOptional();

const ApplicationBody = z.strictObject({
  submissionId: z.guid(),
  roleSlug: z.string().max(80),
  uploadId: z.guid(),
  name: z.string().max(800),
  email: z.string().max(1000),
  phone: optionalText(40),
  location: optionalText(120),
  linkedinUrl: optionalText(300),
  portfolioUrl: optionalText(300),
  rightToWork: z.string().max(40),
  noticePeriod: optionalText(100),
  coverNote: optionalText(3000),
  consent: z.boolean(),
  website: z.string().max(200).exactOptional(),
});

const formFieldToApi: Record<string, string> = { cv: "uploadId" };
const errorCode = (message: string, field: string): string =>
  field === "cv" ? "upload_missing" : message.includes("too long") ? "too_long" : "invalid";

/**
 * `POST /api/careers/applications`: 3 an hour per IP, validation, the role's current privacy
 * notice version from the cached read, then a signed application with the client's IP and user
 * agent (hashed by the admin, never stored raw). Idempotent through `submissionId`.
 */
export async function handleApplicationRequest(
  request: Request,
  deps: CareersDeps,
): Promise<Response> {
  const correlationId = correlationIdFrom(request.headers);
  const blocked = guard(request, deps, correlationId);
  if (blocked) return blocked;
  const limited = await rateLimitedFor(
    deps.limiter,
    request.headers,
    "careers-application",
    correlationId,
    { errors: { form: "rate_limited" } },
  );
  if (limited) return limited;
  if (!deps.client) return json({ error: "unavailable" }, 503, correlationId);

  const read = await readJson(request, MAX_APPLICATION_BODY, correlationId);
  if ("response" in read) return read.response;
  const body = ApplicationBody.safeParse(read.value);
  if (!body.success) return json(errorsBody({ body: "invalid" }), 400, correlationId);
  const data = body.data;
  if (data.website) return json({ error: "rejected" }, 403, correlationId);

  const fieldErrors = validateApplication(
    {
      name: data.name,
      email: data.email,
      phone: data.phone ?? "",
      location: data.location ?? "",
      linkedinUrl: data.linkedinUrl ?? "",
      portfolioUrl: data.portfolioUrl ?? "",
      coverNote: data.coverNote ?? "",
      rightToWork: data.rightToWork,
      noticePeriod: data.noticePeriod ?? "",
      consent: data.consent,
    },
    // The CV was checked when the ticket was issued; the admin checks the stored bytes.
    { name: "cv.pdf", size: 1, type: "application/pdf" },
  );
  if (Object.keys(fieldErrors).length > 0) {
    const errors = Object.fromEntries(
      Object.entries(fieldErrors).map(([field, message]) => [
        formFieldToApi[field] ?? field,
        errorCode(message, field),
      ]),
    );
    return json(errorsBody(errors), 400, correlationId);
  }

  let noticeVersion: string | null = null;
  try {
    const role = await deps.readers.role(data.roleSlug);
    if (role.kind === "ok" && "state" in role.data && role.data.state === "open") {
      noticeVersion = role.data.privacy.noticeVersion;
    }
  } catch {
    return json({ error: "unavailable" }, 503, correlationId);
  }
  if (!noticeVersion) return json(errorsBody({ roleSlug: "role_closed" }), 409, correlationId);

  const payload = ApplicationRequest.safeParse({
    submissionId: data.submissionId,
    roleSlug: data.roleSlug,
    uploadId: data.uploadId,
    name: data.name.trim(),
    email: data.email.trim(),
    phone: (data.phone ?? "").trim(),
    location: (data.location ?? "").trim(),
    linkedinUrl: (data.linkedinUrl ?? "").trim(),
    portfolioUrl: (data.portfolioUrl ?? "").trim(),
    rightToWork: data.rightToWork,
    noticePeriod: (data.noticePeriod ?? "").trim(),
    coverNote: (data.coverNote ?? "").trim(),
    consent: true,
    noticeVersion,
    source: "role_page",
    clientIp: clientIpFromHeaders(request.headers) ?? "",
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 300),
  });
  if (!payload.success) {
    const errors = Object.fromEntries(
      payload.error.issues.map((issue) => [String(issue.path[0] ?? "body"), "invalid"]),
    );
    return json(errorsBody(errors), 400, correlationId);
  }

  try {
    const accepted = await deps.client.post(
      "/api/careers/v1/applications",
      payload.data,
      ApplicationAccepted,
      { scope: "submit", errorSchema: ApplicationErrors },
    );
    const process = accepted.process.trim()
      ? (await deps.renderProcess(accepted.process)).html
      : "";
    deps.logger?.info("careers.application_accepted", {
      correlationId,
      applicationId: accepted.applicationId,
    });
    return json(
      { status: "accepted", roleTitle: accepted.roleTitle, processHtml: process },
      200,
      correlationId,
    );
  } catch (error) {
    if (error instanceof ContentRejectedError) {
      deps.logger?.info("careers.application_refused", { correlationId, status: error.status });
      return rejected(error, correlationId);
    }
    if (error instanceof ContentUnavailableError) {
      deps.logger?.warn("careers.application_unavailable", { correlationId, code: error.code });
      return json({ error: "unavailable" }, 503, correlationId);
    }
    throw error;
  }
}
