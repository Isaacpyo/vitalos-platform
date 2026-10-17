import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ContentRejectedError, ContentUnavailableError } from "../client";
import { MemoryRateLimiter } from "../http/guards";
import { RoleResponse } from "../schemas";
import { mapErrorCodes } from "./form";
import { handleApplicationRequest, handleUploadRequest } from "./http";
import type { CareersDeps, HumanCheck } from "./http";

const origin = "https://www.example.test";
const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../../../contracts/content-api/v1/fixtures/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const ticket = fixture("upload-ticket");
const openRole = RoleResponse.parse(fixture("role-open"));

function harness(
  options: {
    post?: (path: string, body: unknown) => Promise<unknown>;
    human?: HumanCheck;
    role?: "open" | "closed" | "down";
    configured?: boolean;
  } = {},
) {
  const lines: unknown[] = [];
  const post = vi.fn(
    options.post ??
      ((path: string) =>
        Promise.resolve(
          path.endsWith("upload-tickets")
            ? ticket
            : {
                applicationId: "00000000-0000-4000-8000-0000000006a1",
                roleTitle: "Example role (fixture)",
                process: "",
              },
        )),
  );
  const deps: CareersDeps = {
    client: options.configured === false ? null : ({ post } as unknown as CareersDeps["client"]),
    limiter: new MemoryRateLimiter(),
    siteOrigin: origin,
    verifyHuman: vi.fn(() => Promise.resolve(options.human ?? "passed")),
    readers: {
      role: vi.fn(() => {
        if (options.role === "down") return Promise.reject(new ContentUnavailableError("timeout"));
        if (options.role === "closed") {
          return Promise.resolve({
            kind: "ok" as const,
            data: RoleResponse.parse(fixture("role-closed")),
          });
        }
        return Promise.resolve({ kind: "ok" as const, data: openRole });
      }),
    },
    renderProcess: (markdown) =>
      Promise.resolve({ html: `<p>${markdown}</p>`, toc: [], footnotes: 0, warnings: [], faq: [] }),
    logger: {
      info: (...args: unknown[]) => lines.push(args),
      warn: (...args: unknown[]) => lines.push(args),
    },
  };
  return { deps, post, lines };
}

const request = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.20",
      "user-agent": "fixture-agent",
      ...headers,
    },
    body: JSON.stringify(body),
  });

const uploadBody = {
  roleSlug: "example-role-fixture",
  filename: "cv.pdf",
  size: 1000,
  mime: "application/pdf",
  turnstileToken: "token",
};

const applicationBody = {
  submissionId: "00000000-0000-4000-8000-0000000005a1",
  roleSlug: "example-role-fixture",
  uploadId: "00000000-0000-4000-8000-0000000004a1",
  name: "Example Applicant",
  email: "applicant@example.test",
  phone: "",
  location: "Example City",
  linkedinUrl: "",
  portfolioUrl: "",
  rightToWork: "yes",
  noticePeriod: "",
  coverNote: "Example cover note (fixture).",
  consent: true,
};

describe("POST /api/careers/uploads", () => {
  it("verifies Turnstile and returns the admin's ticket, signed with scope submit", async () => {
    const { deps, post } = harness();
    const response = await handleUploadRequest(request("/api/careers/uploads", uploadBody), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(ticket);
    expect(deps.verifyHuman).toHaveBeenCalledWith("token", "198.51.100.20");
    expect(post).toHaveBeenCalledWith(
      "/api/careers/v1/upload-tickets",
      { roleSlug: "example-role-fixture", filename: "cv.pdf", size: 1000, mime: "application/pdf" },
      expect.anything(),
      expect.objectContaining({
        scope: "submit",
        // The admin's per-address cap: the visitor's address travels with the signed request.
        headers: { "x-vitalos-client-ip": "198.51.100.20" },
      }),
    );
  });

  it("403 when Turnstile fails; 503 when Turnstile or the admin is unavailable", async () => {
    const failed = harness({ human: "failed" });
    const refused = await handleUploadRequest(
      request("/api/careers/uploads", uploadBody),
      failed.deps,
    );
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ errors: { turnstile: "invalid" } });
    expect(failed.post).not.toHaveBeenCalled();
    const provider = harness({ human: "unavailable" });
    expect(
      (await handleUploadRequest(request("/api/careers/uploads", uploadBody), provider.deps))
        .status,
    ).toBe(503);
    const down = harness({ post: () => Promise.reject(new ContentUnavailableError("network")) });
    expect(
      (await handleUploadRequest(request("/api/careers/uploads", uploadBody), down.deps)).status,
    ).toBe(503);
  });

  it("refuses wrong types and oversize files before asking the admin", async () => {
    const { deps, post } = harness();
    const exe = await handleUploadRequest(
      request("/api/careers/uploads", {
        ...uploadBody,
        filename: "cv.exe",
        mime: "application/x-msdownload",
      }),
      deps,
    );
    expect(exe.status).toBe(400);
    expect(await exe.json()).toEqual({ errors: { mime: "upload_type" } });
    const big = await handleUploadRequest(
      request("/api/careers/uploads", { ...uploadBody, size: 10 * 1024 * 1024 + 1 }),
      deps,
    );
    expect(await big.json()).toEqual({ errors: { size: "upload_size" } });
    expect(post).not.toHaveBeenCalled();
  });

  it("passes the admin's refusal through in contract codes (a closed role is 409)", async () => {
    const { deps } = harness({
      post: () =>
        Promise.reject(new ContentRejectedError(409, { errors: { roleSlug: "role_closed" } })),
    });
    const response = await handleUploadRequest(request("/api/careers/uploads", uploadBody), deps);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ errors: { roleSlug: "role_closed" } });
  });

  it("prefers the platform's address header and maps the admin's per-address cap", async () => {
    const { deps, post } = harness({
      post: () =>
        Promise.reject(new ContentRejectedError(429, { errors: { uploadId: "rate_limited" } })),
    });
    const response = await handleUploadRequest(
      request("/api/careers/uploads", uploadBody, { "x-vercel-forwarded-for": "203.0.113.5" }),
      deps,
    );
    expect(response.status).toBe(429);
    const body = (await response.json()) as { errors: Record<string, string> };
    expect(body).toEqual({ errors: { uploadId: "rate_limited" } });
    expect(mapErrorCodes(body.errors).form).toBe(
      "You're sending applications quickly. Try again in a few minutes.",
    );
    const options = (post.mock.calls[0] as unknown as unknown[])[3] as {
      headers: Record<string, string>;
    };
    expect(options.headers).toEqual({ "x-vitalos-client-ip": "203.0.113.5" });
  });

  it("allows 5 uploads an hour per IP", async () => {
    const { deps } = harness();
    let last: Response | undefined;
    for (let i = 0; i < 6; i += 1) {
      last = await handleUploadRequest(request("/api/careers/uploads", uploadBody), deps);
    }
    expect(last?.status).toBe(429);
    expect(await last?.json()).toEqual({ errors: { uploadId: "rate_limited" } });
    expect(Number(last?.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("refuses cross-origin, non-JSON, honeypot and unconfigured requests", async () => {
    const { deps } = harness();
    expect(
      (
        await handleUploadRequest(
          request("/api/careers/uploads", uploadBody, { origin: "https://evil.example" }),
          deps,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleUploadRequest(
          request("/api/careers/uploads", uploadBody, { "content-type": "text/plain" }),
          deps,
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await handleUploadRequest(
          request("/api/careers/uploads", { ...uploadBody, website: "spam" }),
          deps,
        )
      ).status,
    ).toBe(403);
    const off = harness({ configured: false });
    expect(
      (await handleUploadRequest(request("/api/careers/uploads", uploadBody), off.deps)).status,
    ).toBe(503);
  });
});

describe("POST /api/careers/applications", () => {
  it("forwards a valid application with the notice version, client IP and user agent", async () => {
    const { deps, post, lines } = harness({
      post: () =>
        Promise.resolve({
          applicationId: "00000000-0000-4000-8000-0000000006a1",
          roleTitle: "Example role (fixture)",
          process: "We reply within a week.",
        }),
    });
    const response = await handleApplicationRequest(
      request("/api/careers/applications", applicationBody),
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "accepted",
      roleTitle: "Example role (fixture)",
      processHtml: "<p>We reply within a week.</p>",
    });
    const [path, sent, , options] = post.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
      unknown,
      unknown,
    ];
    expect(path).toBe("/api/careers/v1/applications");
    expect(sent).toMatchObject({
      noticeVersion: "2026-10",
      source: "role_page",
      clientIp: "198.51.100.20",
      userAgent: "fixture-agent",
      consent: true,
    });
    expect(options).toMatchObject({ scope: "submit" });
    // No personal data in logs: ids, statuses and codes only.
    const logged = JSON.stringify(lines);
    for (const value of [
      "Example Applicant",
      "applicant@example.test",
      "198.51.100.20",
      "cover note",
    ]) {
      expect(logged).not.toContain(value);
    }
  });

  it("validates before forwarding", async () => {
    const { deps, post } = harness();
    const response = await handleApplicationRequest(
      request("/api/careers/applications", { ...applicationBody, email: "nope", consent: false }),
      deps,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ errors: { email: "invalid", consent: "invalid" } });
    expect(post).not.toHaveBeenCalled();
  });

  it("409 when the role has closed (cached read or the admin)", async () => {
    const cached = harness({ role: "closed" });
    const early = await handleApplicationRequest(
      request("/api/careers/applications", applicationBody),
      cached.deps,
    );
    expect(early.status).toBe(409);
    expect(await early.json()).toEqual({ errors: { roleSlug: "role_closed" } });
    const admin = harness({
      post: () =>
        Promise.reject(new ContentRejectedError(409, { errors: { roleSlug: "role_closed" } })),
    });
    expect(
      (
        await handleApplicationRequest(
          request("/api/careers/applications", applicationBody),
          admin.deps,
        )
      ).status,
    ).toBe(409);
  });

  it("passes upload and rate-limit refusals through; 503 when the admin is unreachable", async () => {
    const upload = harness({
      post: () =>
        Promise.reject(new ContentRejectedError(422, { errors: { uploadId: "upload_type" } })),
    });
    const refused = await handleApplicationRequest(
      request("/api/careers/applications", applicationBody),
      upload.deps,
    );
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({ errors: { uploadId: "upload_type" } });
    const limited = harness({
      post: () =>
        Promise.reject(new ContentRejectedError(429, { errors: { email: "rate_limited" } })),
    });
    expect(
      (
        await handleApplicationRequest(
          request("/api/careers/applications", applicationBody),
          limited.deps,
        )
      ).status,
    ).toBe(429);
    const down = harness({ post: () => Promise.reject(new ContentUnavailableError("timeout")) });
    expect(
      (
        await handleApplicationRequest(
          request("/api/careers/applications", applicationBody),
          down.deps,
        )
      ).status,
    ).toBe(503);
    const roleDown = harness({ role: "down" });
    expect(
      (
        await handleApplicationRequest(
          request("/api/careers/applications", applicationBody),
          roleDown.deps,
        )
      ).status,
    ).toBe(503);
  });

  it("allows 3 applications an hour per IP", async () => {
    const { deps } = harness();
    let last: Response | undefined;
    for (let i = 0; i < 4; i += 1) {
      last = await handleApplicationRequest(
        request("/api/careers/applications", applicationBody),
        deps,
      );
    }
    expect(last?.status).toBe(429);
    expect(await last?.json()).toEqual({ errors: { form: "rate_limited" } });
  });

  it("caps the body size", async () => {
    const { deps } = harness();
    const response = await handleApplicationRequest(
      request("/api/careers/applications", { ...applicationBody, coverNote: "x".repeat(30_000) }),
      deps,
    );
    expect(response.status).toBe(413);
  });
});
