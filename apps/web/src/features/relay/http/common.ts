import { COPY, RelayError } from "@vitalos/relay-core";
import type { ErrorCode } from "@vitalos/relay-core";
import type { z } from "zod";

export const NO_STORE = { "cache-control": "no-store" } as const;

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  invalid: COPY.invalid,
  unauthorised: COPY.unauthorised,
  rate_limited: COPY.rateLimited,
  too_long: COPY.tooLong,
  unavailable: COPY.unavailable,
  conversation_closed: COPY.closed,
  deleted: COPY.deleted,
  turnstile_failed: COPY.sendFailed,
  forbidden_origin: COPY.sendFailed,
  not_found: "Not found.",
};

export function errorResponse(code: ErrorCode, status: number, message?: string): Response {
  return json({ error: { code, message: message ?? MESSAGES[code] ?? COPY.sendFailed } }, status);
}

/** Maps any thrown value to `{ error: { code, message } }`; unknown failures become 503. */
export function fromError(error: unknown): Response {
  if (error instanceof RelayError)
    return errorResponse(
      error.code,
      error.status,
      error.message === error.code ? undefined : error.message,
    );
  return errorResponse("unavailable", 503);
}

/** Parses a JSON body with a zod schema; the first field error becomes the message. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes = 16_384,
): Promise<z.infer<S>> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > maxBytes) throw new RelayError("too_long", COPY.tooLong);
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > maxBytes) throw new RelayError("too_long", COPY.tooLong);
    raw = text ? JSON.parse(text) : {};
  } catch (error) {
    if (error instanceof RelayError) throw error;
    throw new RelayError("invalid");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const tooLong = parsed.error.issues.some(
      (i) => i.code === "too_big" && i.path.includes("text"),
    );
    if (tooLong) throw new RelayError("too_long", COPY.tooLong);
    throw new RelayError(
      "invalid",
      issue?.message && !/^(Invalid|Expected)/.test(issue.message) ? issue.message : COPY.invalid,
    );
  }
  return parsed.data as z.infer<S>;
}

export function bearer(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(h);
  return m?.[1] ?? null;
}
