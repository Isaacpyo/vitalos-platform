/**
 * Request correlation. The id travels in the `x-request-id` header (set by `apps/web/proxy.ts`)
 * and is attached to every log line and error report for the request.
 */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Inbound ids are only trusted when they look like an id. Anything else (long values, control
 * characters, spaces) is replaced: the value ends up in logs and response headers, so an
 * attacker-controlled id must not be able to forge log lines.
 */
const requestIdPattern = /^[A-Za-z0-9._-]{8,128}$/;

export const isValidRequestId = (value: string | null | undefined): value is string =>
  typeof value === "string" && requestIdPattern.test(value);

export const createRequestId = (): string => crypto.randomUUID();

/** Returns the inbound request id when valid, otherwise a fresh one. */
export const correlationId = (headers: Pick<Headers, "get">): string => {
  const inbound = headers.get(REQUEST_ID_HEADER);
  return isValidRequestId(inbound) ? inbound : createRequestId();
};
