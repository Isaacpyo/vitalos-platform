import "server-only";
import type { z } from "zod";
import type { Logger } from "@vitalos/observability";
import { PREVIEW_TOKEN_HEADER, signRequest } from "./signing";
import type { SigningKey, SigningScope } from "./signing";

/**
 * Signed HTTP client for the Super Admin's content API (ADR-036). Framework-free and injectable
 * (`fetch`, clock, logger) so it is unit-tested with a mocked fetch; `server.ts` wires it to the
 * validated environment and is the only server-only entry.
 *
 * - Every request is signed with scheme v1 (path and query exactly as sent).
 * - 2.5 s timeout per attempt; exactly one retry on a network error, a timeout or a 5xx.
 * - Every 2xx body is validated with the operation's zod schema; an invalid payload is an error.
 * - 404 is `ContentNotFoundError` (callers may cache it as "missing"); anything else that is not a
 *   valid 2xx is `ContentUnavailableError`, so a failed read is never cached.
 * - Logs carry the endpoint, method, status, attempt, duration and error code only: never
 *   bodies, query strings or headers.
 */

export const CONTENT_TIMEOUT_MS = 2500;
const RETRY_DELAY_MS = 100;

export type ContentErrorCode =
  "network" | "timeout" | "http_5xx" | "http_4xx" | "invalid_payload" | "not_configured";

/** The admin could not give a usable answer. Never cache this. */
export class ContentUnavailableError extends Error {
  readonly code: ContentErrorCode;
  readonly status: number | undefined;
  constructor(code: ContentErrorCode, status?: number) {
    super(`Content API unavailable (${code}${status === undefined ? "" : ` ${status}`})`);
    this.name = "ContentUnavailableError";
    this.code = code;
    this.status = status;
  }
}

/** The admin answered 404: unknown or not public. Cacheable as "missing". */
export class ContentNotFoundError extends Error {
  constructor() {
    super("Content not found");
    this.name = "ContentNotFoundError";
  }
}

export interface ContentClientDeps {
  baseUrl: string;
  readKey: SigningKey;
  submitKey?: SigningKey | undefined;
  fetch?: typeof fetch;
  logger?: Pick<Logger, "info" | "warn">;
  timeoutMs?: number;
  /** Unix seconds, for signing. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RequestOptions {
  scope?: SigningScope;
  /** Extra headers (for example the preview token). Never logged. */
  headers?: Record<string, string>;
  /**
   * For endpoints that explain a refusal (400, 409, 422, 429 with `{ errors }`): the body is
   * validated with this schema and thrown as `ContentRejectedError`. Never logged.
   */
  errorSchema?: z.ZodType;
}

/** Statuses whose body carries the contract's `{ errors }` explanation. */
const EXPLAINED = new Set([400, 409, 422, 429]);

/** The admin refused the request and said why (`{ errors: { field: code } }`). */
export class ContentRejectedError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    super(`Content API refused the request (${status})`);
    this.name = "ContentRejectedError";
    this.status = status;
    this.body = body;
  }
}

export interface ContentClient {
  get<T extends z.ZodType>(
    pathAndQuery: string,
    schema: T,
    options?: RequestOptions,
  ): Promise<z.output<T>>;
  post<T extends z.ZodType>(
    path: string,
    body: unknown,
    schema: T,
    options?: RequestOptions,
  ): Promise<z.output<T>>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The path without its query string, for logs (query values may carry slugs or filters). */
const endpointOf = (pathAndQuery: string): string => pathAndQuery.split("?")[0] ?? pathAndQuery;

type Attempt =
  | { kind: "response"; status: number; json: unknown; parsed: boolean }
  | { kind: "error"; code: "network" | "timeout" };

export function createContentClient(deps: ContentClientDeps): ContentClient {
  const fetchImpl = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? CONTENT_TIMEOUT_MS;
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const sleep = deps.sleep ?? defaultSleep;
  const base = deps.baseUrl.replace(/\/+$/, "");

  async function attempt(
    method: "GET" | "POST",
    pathAndQuery: string,
    body: string | undefined,
    scope: SigningScope,
    extra: Record<string, string>,
    explained: boolean,
  ): Promise<Attempt> {
    const key = scope === "submit" ? deps.submitKey : deps.readKey;
    if (!key) throw new ContentUnavailableError("not_configured");
    const headers: Record<string, string> = {
      accept: "application/json",
      ...extra,
      ...signRequest({ key, scope, method, pathAndQuery, body: body ?? "", timestamp: now() }),
    };
    if (body !== undefined) headers["content-type"] = "application/json";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${base}${pathAndQuery}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });
      if (explained && EXPLAINED.has(response.status)) {
        try {
          return {
            kind: "response",
            status: response.status,
            json: await response.json(),
            parsed: true,
          };
        } catch {
          return { kind: "response", status: response.status, json: undefined, parsed: false };
        }
      }
      if (response.status < 200 || response.status >= 300) {
        await response.body?.cancel().catch(() => undefined);
        return { kind: "response", status: response.status, json: undefined, parsed: false };
      }
      // The body is read inside the timeout too: a stalled body is a timeout, not a hang.
      try {
        return {
          kind: "response",
          status: response.status,
          json: await response.json(),
          parsed: true,
        };
      } catch {
        if (controller.signal.aborted) return { kind: "error", code: "timeout" };
        return { kind: "response", status: response.status, json: undefined, parsed: false };
      }
    } catch {
      return { kind: "error", code: controller.signal.aborted ? "timeout" : "network" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function request<T extends z.ZodType>(
    method: "GET" | "POST",
    pathAndQuery: string,
    body: string | undefined,
    schema: T,
    options: RequestOptions,
  ): Promise<z.output<T>> {
    const scope = options.scope ?? "read";
    const endpoint = endpointOf(pathAndQuery);
    const log = (
      level: "info" | "warn",
      fields: { status?: number; attempt: number; code?: string; started: number },
    ) =>
      deps.logger?.[level]("content.api", {
        method,
        endpoint,
        attempt: fields.attempt,
        durationMs: Date.now() - fields.started,
        ...(fields.status === undefined ? {} : { status: fields.status }),
        ...(fields.code === undefined ? {} : { code: fields.code }),
      });

    for (let attemptNo = 1; ; attemptNo += 1) {
      const started = Date.now();
      const result = await attempt(
        method,
        pathAndQuery,
        body,
        scope,
        options.headers ?? {},
        options.errorSchema !== undefined,
      );
      const last = attemptNo >= 2;

      if (result.kind === "error") {
        log("warn", { attempt: attemptNo, code: result.code, started });
        if (!last) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new ContentUnavailableError(result.code);
      }

      const { status } = result;
      if (status >= 500) {
        log("warn", { attempt: attemptNo, status, code: "http_5xx", started });
        if (!last) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new ContentUnavailableError("http_5xx", status);
      }
      if (status === 404) {
        log("info", { attempt: attemptNo, status, started });
        throw new ContentNotFoundError();
      }
      if (options.errorSchema && EXPLAINED.has(status)) {
        const explanation = result.parsed ? options.errorSchema.safeParse(result.json) : null;
        log("info", { attempt: attemptNo, status, code: "rejected", started });
        if (explanation?.success) throw new ContentRejectedError(status, explanation.data);
        throw new ContentUnavailableError("invalid_payload", status);
      }
      if (status < 200 || status >= 300) {
        log("warn", { attempt: attemptNo, status, code: "http_4xx", started });
        throw new ContentUnavailableError("http_4xx", status);
      }

      if (!result.parsed) {
        log("warn", { attempt: attemptNo, status, code: "invalid_payload", started });
        throw new ContentUnavailableError("invalid_payload", status);
      }
      const parsed = schema.safeParse(result.json);
      if (!parsed.success) {
        // Issue paths only: never the values.
        log("warn", { attempt: attemptNo, status, code: "invalid_payload", started });
        throw new ContentUnavailableError("invalid_payload", status);
      }
      log("info", { attempt: attemptNo, status, started });
      return parsed.data;
    }
  }

  return {
    get: (pathAndQuery, schema, options = {}) =>
      request("GET", pathAndQuery, undefined, schema, options),
    post: (path, body, schema, options = {}) =>
      request("POST", path, JSON.stringify(body), schema, options),
  };
}

/** Header carrying the preview token on `GET preview/{entity}/{id}`. */
export const previewTokenHeader = (token: string): Record<string, string> => ({
  [PREVIEW_TOKEN_HEADER]: token,
});
