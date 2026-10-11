import type { Instrumentation } from "next";
import { readBuildEnv } from "@vitalos/config/build";
import {
  REQUEST_ID_HEADER,
  createConsoleErrorReporter,
  createLogger,
  isValidRequestId,
} from "@vitalos/observability";

const SERVICE = "vitalos-web";

function deployEnvLabel(): string {
  try {
    return readBuildEnv().deployEnv;
  } catch {
    // An invalid environment is reported at build/start; never throw from error reporting.
    return "unknown";
  }
}

/** Runs once per server instance, before it serves requests. */
export function register() {
  createLogger({ service: SERVICE, env: deployEnvLabel() }).info("server.started", {
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
  });
}

/**
 * Server errors (render, route handler, server action, proxy) go to the ErrorReporter. Only the
 * path without its query string, the method, the Next.js route and the correlation id are
 * recorded: query strings and bodies can carry personal data. A Sentry adapter replaces the
 * console reporter here once the owner supplies a DSN (ADR-020, plan section 6).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const logger = createLogger({ service: SERVICE, env: deployEnvLabel() });
  const rawId = request.headers[REQUEST_ID_HEADER];
  const requestId = Array.isArray(rawId) ? rawId[0] : rawId;

  await createConsoleErrorReporter(logger).captureException(error, {
    ...(isValidRequestId(requestId) ? { correlationId: requestId } : {}),
    source: "request",
    attributes: {
      method: request.method,
      path: request.path.split("?")[0],
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    },
  });
};
