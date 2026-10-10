/**
 * Redaction for logs, error context and analytics payloads.
 *
 * Two layers, because keys alone are not enough: sensitive KEYS are masked wholesale, and
 * email-shaped substrings inside any string VALUE are masked so a stray address in free text
 * (a thrown error message, a URL, a form echo) never reaches a log line. Redaction is
 * recursive, tolerant of cycles, bounded in depth and string length, never mutates its input
 * and never throws.
 *
 * Every string is truncated to `MAX_STRING_LENGTH` BEFORE any regular expression runs, and the
 * patterns are written to be linear, so hostile input (a huge request body echoed into an error)
 * cannot stall the process.
 */
export const REDACTED = "[REDACTED]";
export const REDACTED_EMAIL = "[REDACTED_EMAIL]";
export const TRUNCATED = "[TRUNCATED]";

const MAX_DEPTH = 8;
export const MAX_STRING_LENGTH = 8192;

/** Credentials and secrets. */
const credentialKey =
  /token|secret|password|passwd|authorization|cookie|api[-_]?key|private[-_]?key|session|signature|credential/i;

/**
 * Names that end in `name` but are operational, not personal. Everything else ending in `name`
 * (userName, username, senderName, firstName, ...) is treated as personal data.
 */
const operationalNameKey =
  /^(host|file|path|dir|class|event|route|service|app|package|function|region|env|type|error|analytics[-_]?event)[-_]?name$/i;

/**
 * Personal data captured by the enquiry flow (Stage 10 section 25: collect only what is needed,
 * never log it): email, phone, names, free text (message, goal, comments, notes, details, body,
 * payload), organisation and address fields.
 */
const personalKey =
  /e[-_]?mail|phone|telephone|mobile|name$|message$|goal$|(body|payload)$|^(comments?|details?|notes?)$|^company$|organi[sz]ation|^address$/i;

/**
 * Client network identifiers. A bare `ip` is matched at a word or camelCase boundary
 * (`ip`, `client_ip`, `clientIp`, `sourceIP`), case-sensitively, so words that merely end in
 * "ip" (zip, membership, relationship) stay readable.
 */
const ipKey = /^[Ii][Pp]$|[-_.][Ii][Pp]$|[a-z0-9](Ip|IP)$/;
const ipAddressKey = /ip[-_]?address|remote[-_]?ip/i;
const forwardingHeaderKey =
  /^(x-forwarded-[a-z-]+|x-real-ip|cf-connecting-ip|true-client-ip|forwarded)$/i;

export const isSensitiveKey = (key: string): boolean =>
  credentialKey.test(key) ||
  (personalKey.test(key) && !operationalNameKey.test(key)) ||
  ipKey.test(key) ||
  ipAddressKey.test(key) ||
  forwardingHeaderKey.test(key);

/**
 * The `(?<![...])` lookbehind makes a match start only at the beginning of a local-part run, so
 * a long run of local-part characters is scanned once instead of once per character (which was
 * quadratic).
 */
const emailPattern = /(?<![A-Za-z0-9._%+'-])[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const bearerPattern = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;

/** Caps a string at `MAX_STRING_LENGTH` characters, marking the cut. */
export const truncateString = (value: string): string =>
  value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)} ${TRUNCATED}` : value;

/** Truncates, then masks email addresses and bearer/basic credentials inside free text. */
export const redactString = (value: string): string =>
  truncateString(value)
    .replace(emailPattern, REDACTED_EMAIL)
    .replace(bearerPattern, `$1 ${REDACTED}`);

function walk(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint" || typeof value === "symbol") return value.toString();
  if (typeof value === "function") return "[Function]";
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  if (depth >= MAX_DEPTH) return "[Truncated]";
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1, seen));
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? "[Invalid Date]" : value.toISOString();
    }
    if (value instanceof Error) {
      return { type: String(value.name), message: redactString(String(value.message)) };
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (isSensitiveKey(key)) {
        out[key] = REDACTED;
        continue;
      }
      try {
        out[key] = walk((value as Record<string, unknown>)[key], depth + 1, seen);
      } catch {
        // A throwing getter or proxy trap must not break logging.
        out[key] = "[Unreadable]";
      }
    }
    return out;
  } catch {
    return "[Unreadable]";
  } finally {
    seen.delete(value);
  }
}

/** Redacts any value (object, array or string). */
export const redactValue = (value: unknown): unknown => walk(value, 0, new WeakSet());

/** Redacts a record: sensitive keys become `[REDACTED]`, nested values are scrubbed. */
export const redact = (record: Record<string, unknown>): Record<string, unknown> => {
  const out = walk(record, 0, new WeakSet());
  return out !== null && typeof out === "object" && !Array.isArray(out)
    ? (out as Record<string, unknown>)
    : {};
};
