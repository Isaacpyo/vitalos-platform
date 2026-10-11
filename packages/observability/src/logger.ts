import { redact, redactString } from "@vitalos/security/redact";

/**
 * Structured JSON logger (Stage 0 §26). One JSON object per line with `timestamp`, `severity`,
 * `service`, `env`, `event` and, when known, `correlationId`. All attributes pass through the
 * shared redactor before they are serialised, so credentials and enquiry personal data
 * (email, name, goal, ...) and email-shaped strings never reach a log line.
 *
 * Provider-neutral (ADR-011): the output is a line sink, not a vendor SDK.
 */
export type Severity = "debug" | "info" | "warn" | "error";

const severityRank: Record<Severity, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type Attributes = Record<string, unknown>;

/**
 * `event` MUST be a static literal (`"enquiry.received"`), never built from input: it is the one
 * field that is not redacted by key, only scrubbed for emails. Put variable data in `attributes`.
 */
export interface Logger {
  debug(event: string, attributes?: Attributes): void;
  info(event: string, attributes?: Attributes): void;
  warn(event: string, attributes?: Attributes): void;
  error(event: string, error: unknown, attributes?: Attributes): void;
  /** A logger that adds `bindings` (for example `correlationId`) to every record. */
  child(bindings: Attributes): Logger;
}

export interface LogRecord extends Attributes {
  timestamp: string;
  severity: Severity;
  service: string;
  env: string;
  event: string;
  correlationId?: string;
}

export interface LoggerOptions {
  service: string;
  env: string;
  correlationId?: string;
  /** Records below this severity are dropped. Default `info`. */
  minSeverity?: Severity;
  /** Receives one serialised JSON line per record. Default writes to the console. */
  sink?: (line: string, severity: Severity) => void;
  /** Injectable clock for tests. */
  now?: () => Date;
  bindings?: Attributes;
}

const consoleSink = (line: string, severity: Severity): void => {
  if (severity === "error") console.error(line);
  else if (severity === "warn") console.warn(line);
  else console.log(line);
};

/** Reserved record keys cannot be overwritten by caller attributes. */
const reserved = new Set(["timestamp", "severity", "service", "env", "event", "correlationId"]);

/** Stack frames only: the first line of `error.stack` repeats the message, which may hold input. */
function stackFrames(stack: string): string | undefined {
  const start = stack.search(/^\s+at /m);
  return start === -1 ? undefined : stack.slice(start);
}

/**
 * Safe error shape: name, redacted message and redacted stack frames. No custom error fields.
 * `SyntaxError` messages (for example from `JSON.parse`) quote the offending input text, so they
 * are replaced with a generic message.
 */
export function serializeError(error: unknown): Attributes {
  try {
    if (error instanceof Error) {
      const isSyntaxError = error instanceof SyntaxError;
      const out: Attributes = {
        type: redactString(String(error.name)),
        message: isSyntaxError
          ? "Syntax error (message omitted: it may quote input text)"
          : redactString(String(error.message)),
      };
      const frames = typeof error.stack === "string" ? stackFrames(error.stack) : undefined;
      if (frames) out.stack = redactString(frames);
      const digest = (error as { digest?: unknown }).digest;
      if (typeof digest === "string") out.digest = redactString(digest);
      return out;
    }
    return { type: "NonError", message: redactString(String(error)) };
  } catch {
    return { type: "Unserializable", message: "[Unreadable]" };
  }
}

export function createLogger(options: LoggerOptions): Logger {
  const min = severityRank[options.minSeverity ?? "info"];
  const sink = options.sink ?? consoleSink;
  const now = options.now ?? (() => new Date());
  const bindings = options.bindings ?? {};

  function write(
    severity: Severity,
    event: string,
    attributes: Attributes | undefined,
    error?: unknown,
  ): void {
    if (severityRank[severity] < min) return;
    // Logging must never throw into the code path being observed (throwing getters, bigint,
    // invalid dates, a failing sink or clock): fall back to a fixed, safe line instead.
    try {
      // Redact each source on its own: spreading would invoke throwing getters unguarded.
      const safe = { ...redact(bindings), ...redact(attributes ?? {}) };
      for (const key of reserved) delete safe[key];
      const record: LogRecord = {
        timestamp: now().toISOString(),
        severity,
        service: options.service,
        env: options.env,
        event: redactString(String(event)),
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
        ...safe,
        ...(error === undefined ? {} : { error: serializeError(error) }),
      };
      sink(JSON.stringify(record), severity);
    } catch {
      try {
        sink(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            severity,
            service: options.service,
            env: options.env,
            event: "log.failed",
          }),
          severity,
        );
      } catch {
        // Nothing left to do; swallow rather than break the caller.
      }
    }
  }

  return {
    debug: (event, attributes) => write("debug", event, attributes),
    info: (event, attributes) => write("info", event, attributes),
    warn: (event, attributes) => write("warn", event, attributes),
    error: (event, error, attributes) => write("error", event, attributes, error),
    child: (childBindings) => {
      const { correlationId, ...rest } = childBindings;
      const nextCorrelationId = typeof correlationId === "string" ? correlationId : undefined;
      return createLogger({
        ...options,
        ...(nextCorrelationId ? { correlationId: nextCorrelationId } : {}),
        bindings: { ...bindings, ...rest },
      });
    },
  };
}
