import type { Clock, EnquiryLogger } from "./domain/ports";

/** Artificial enquiry body (`*.invalid` addresses only) shaped like the JSON endpoint input. */
export const validBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: "Example Person (fixture)",
  organisation: "Example Organisation (fixture)",
  workEmail: "person@example.invalid",
  role: "Fixture role",
  goal: "Clearly artificial non-production enquiry fixture used by automated tests.",
  timeframe: "within-3-months",
  intent: "project",
  sourcePath: "/contact",
  consent: true,
  privacyNoticeVersion: "fixture-1",
  idempotencyKey: crypto.randomUUID(),
  ...overrides,
});

/** Strings that must never appear in logs, results or stored errors. */
export const piiMarkers = [
  "person@example.invalid",
  "Example Person",
  "Clearly artificial non-production enquiry",
  "Example Organisation",
];

export interface LoggedLine {
  level: "info" | "warn" | "error";
  event: string;
  fields: Record<string, unknown>;
}

export function recordingLogger(): EnquiryLogger & { lines: LoggedLine[] } {
  const lines: LoggedLine[] = [];
  const at =
    (level: LoggedLine["level"]) =>
    (event: string, fields: Record<string, unknown> = {}) => {
      lines.push({ level, event, fields });
    };
  return { lines, info: at("info"), warn: at("warn"), error: at("error") };
}

export function mutableClock(start = new Date("2026-10-11T09:00:00.000Z")): Clock & {
  advance(seconds: number): void;
} {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(seconds: number) {
      current += seconds * 1000;
    },
  };
}

export const siteOrigin = "https://www.example.invalid";

export function jsonRequest(
  body: unknown,
  headers: Record<string, string> = {},
  init: { method?: string; rawBody?: string } = {},
): Request {
  return new Request(`${siteOrigin}/api/enquiries`, {
    method: init.method ?? "POST",
    headers: {
      "content-type": "application/json",
      origin: siteOrigin,
      "x-forwarded-for": "203.0.113.7",
      ...headers,
    },
    body: init.rawBody ?? JSON.stringify(body),
  });
}
