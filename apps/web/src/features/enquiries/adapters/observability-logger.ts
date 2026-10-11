import { createLogger } from "@vitalos/observability";
import type { Logger } from "@vitalos/observability";
import type { EnquiryLogger } from "../domain/ports";

/**
 * Adapts the shared structured logger (`@vitalos/observability`) to the enquiry feature's
 * logging port. Every record passes through the shared redactor, which masks personal-data keys
 * and email-shaped strings, in addition to the feature's own rule of logging identifiers only.
 */
export function createEnquiryLogger(options: {
  env: string;
  logger?: Logger;
  sink?: (line: string) => void;
}): EnquiryLogger {
  const logger =
    options.logger ??
    createLogger({
      service: "vitalos-web",
      env: options.env,
      ...(options.sink ? { sink: options.sink } : {}),
    });
  return {
    info: (event, fields) => logger.info(event, fields),
    warn: (event, fields) => logger.warn(event, fields),
    // The port takes identifiers only, never an Error object: its message could echo input.
    error: (event, fields) => logger.error(event, undefined, fields),
  };
}

export const silentLogger: EnquiryLogger = { info() {}, warn() {}, error() {} };
