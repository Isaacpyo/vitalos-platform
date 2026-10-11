import type { Attributes, Logger } from "./logger";

/**
 * Error capture contract (ADR-011, ADR-020). Application code depends on this interface only,
 * never on a vendor SDK. The console implementation below is what ships today; a Sentry adapter
 * implementing the same interface is blocked on the owner providing a DSN (plan section 6).
 */
export interface ErrorContext {
  correlationId?: string;
  /** Where the error was captured, for example `request`, `enquiry-delivery`. */
  source?: string;
  /** Safe, non-PII metadata. Redacted before it is emitted. */
  attributes?: Attributes;
}

export interface ErrorReporter {
  captureException(error: unknown, context?: ErrorContext): void | Promise<void>;
}

/** Reports through the structured logger (severity `error`, event `error.captured`). */
export function createConsoleErrorReporter(logger: Logger): ErrorReporter {
  return {
    captureException(error, context) {
      const scoped = context?.correlationId
        ? logger.child({ correlationId: context.correlationId })
        : logger;
      scoped.error("error.captured", error, {
        ...(context?.source ? { source: context.source } : {}),
        ...context?.attributes,
      });
    },
  };
}

/** Drops every report. For tests and for environments that opt out explicitly. */
export const noopErrorReporter: ErrorReporter = { captureException() {} };
