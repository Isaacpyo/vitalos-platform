import { describe, expect, it } from "vitest";
import {
  correlationId,
  createConsoleErrorReporter,
  createLogger,
  isValidRequestId,
  noopErrorReporter,
} from "./index";

const FIXTURE_EMAIL = "jane.doe@client-example.invalid";

function capture(options: Partial<Parameters<typeof createLogger>[0]> = {}) {
  const lines: string[] = [];
  const logger = createLogger({
    service: "web",
    env: "test",
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    sink: (line) => lines.push(line),
    ...options,
  });
  return {
    logger,
    lines,
    records: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>),
  };
}

describe("logger", () => {
  it("emits structured JSON with the required fields", () => {
    const { logger, records } = capture({ correlationId: "req-12345678" });
    logger.info("enquiry.received", { route: "/contact" });
    expect(records()).toEqual([
      {
        timestamp: "2026-01-02T03:04:05.000Z",
        severity: "info",
        service: "web",
        env: "test",
        event: "enquiry.received",
        correlationId: "req-12345678",
        route: "/contact",
      },
    ]);
  });

  it("never emits a fixture email, in keys, values, messages, events or errors", () => {
    const { logger, lines } = capture();
    logger.info(`sent to ${FIXTURE_EMAIL}`, {
      email: FIXTURE_EMAIL,
      payload: { contactEmail: FIXTURE_EMAIL, note: `reply to ${FIXTURE_EMAIL}` },
      list: [FIXTURE_EMAIL],
      name: "Jane Doe",
      goal: "Modernise our platform",
    });
    logger.error("delivery.failed", new Error(`SMTP rejected ${FIXTURE_EMAIL}`), {
      to: FIXTURE_EMAIL,
    });
    logger.error("delivery.failed", `non-error ${FIXTURE_EMAIL}`);
    const output = lines.join("\n");
    expect(output).not.toContain(FIXTURE_EMAIL);
    expect(output).not.toContain("client-example");
    expect(output).not.toContain("Jane Doe");
    expect(output).not.toContain("Modernise our platform");
  });

  it("redacts credentials", () => {
    const { logger, lines } = capture();
    logger.info("call", { authorization: "Bearer abcdefghijklmnop", turnstileToken: "tok" });
    expect(lines[0]).not.toContain("abcdefghijklmnop");
    expect(lines[0]).toContain(`"turnstileToken":"[REDACTED]"`);
  });

  it("serialises errors with type, message and stack", () => {
    const { logger, records } = capture();
    const error = Object.assign(new Error("boom"), { digest: "d123" });
    logger.error("render.failed", error);
    const record = records()[0]!;
    expect(record.severity).toBe("error");
    expect(record.error).toMatchObject({ type: "Error", message: "boom", digest: "d123" });
  });

  it("replaces JSON SyntaxError messages, which quote input text", () => {
    const { logger, lines } = capture();
    let thrown: unknown;
    try {
      JSON.parse(`{"email": "${FIXTURE_EMAIL}", oops`);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SyntaxError);
    logger.error("parse.failed", thrown);
    const output = lines.join("\n");
    expect(output).not.toContain(FIXTURE_EMAIL);
    expect(output).not.toContain("oops");
    expect((JSON.parse(output) as { error: { message: string } }).error.message).toContain(
      "message omitted",
    );
  });

  it("keeps the thrown message out of the stack", () => {
    const { logger, lines } = capture();
    logger.error("failed", new Error("secret-ish input text"));
    const record = JSON.parse(lines[0]!) as { error: { stack?: string } };
    expect(record.error.stack ?? "").not.toContain("secret-ish input text");
  });

  it("never throws: bigint, invalid dates, throwing getters, failing clock or sink", () => {
    const { logger, records } = capture();
    const hostile = {
      big: 5n,
      when: new Date("nope"),
      get boom(): string {
        throw new Error("getter");
      },
    };
    expect(() => logger.info("hostile", hostile)).not.toThrow();
    expect(records()[0]).toMatchObject({ big: "5", when: "[Invalid Date]", boom: "[Unreadable]" });

    const lines: string[] = [];
    const badClock = createLogger({
      service: "web",
      env: "test",
      now: () => new Date("nope"),
      sink: (line) => lines.push(line),
    });
    expect(() => badClock.info("clock")).not.toThrow();
    expect(JSON.parse(lines[0]!)).toMatchObject({ event: "log.failed", service: "web" });

    const badSink = createLogger({
      service: "web",
      env: "test",
      sink: () => {
        throw new Error("disk full");
      },
    });
    expect(() => badSink.error("sink", new Error("x"))).not.toThrow();
  });

  it("stays fast and bounded on hostile input", () => {
    const { logger, lines } = capture();
    const started = performance.now();
    logger.info("big", { context: "a".repeat(200_000) });
    logger.error("big", new Error("a".repeat(200_000)));
    expect(performance.now() - started).toBeLessThan(200);
    expect(lines.join("").length).toBeLessThan(30_000);
  });

  it("does not let attributes overwrite reserved fields", () => {
    const { logger, records } = capture();
    logger.info("real.event", { severity: "debug", service: "evil", event: "fake", env: "prod" });
    expect(records()[0]).toMatchObject({
      severity: "info",
      service: "web",
      env: "test",
      event: "real.event",
    });
  });

  it("filters below the minimum severity and supports child bindings", () => {
    const { logger, records } = capture();
    logger.debug("hidden");
    const child = logger.child({ correlationId: "abcdefgh1", route: "/x" });
    child.warn("shown");
    expect(records()).toHaveLength(1);
    expect(records()[0]).toMatchObject({
      severity: "warn",
      correlationId: "abcdefgh1",
      route: "/x",
    });
  });
});

describe("correlationId", () => {
  it("reuses a well-formed inbound id", () => {
    expect(correlationId(new Headers({ "x-request-id": "abc-12345678" }))).toBe("abc-12345678");
  });

  it("replaces missing or malformed ids", () => {
    expect(isValidRequestId("short")).toBe(false);
    const forged = correlationId(new Headers({ "x-request-id": 'x"},{"severity":"error' }));
    expect(forged).not.toContain('"');
    expect(isValidRequestId(forged)).toBe(true);
    expect(isValidRequestId(correlationId(new Headers()))).toBe(true);
  });
});

describe("error reporters", () => {
  it("console reporter logs error.captured with correlation id and redacted context", () => {
    const { logger, records } = capture();
    const reporter = createConsoleErrorReporter(logger);
    void reporter.captureException(new Error(`bad ${FIXTURE_EMAIL}`), {
      correlationId: "corr-12345678",
      source: "request",
      attributes: { email: FIXTURE_EMAIL, route: "/contact" },
    });
    const record = records()[0]!;
    expect(record).toMatchObject({
      event: "error.captured",
      correlationId: "corr-12345678",
      source: "request",
      route: "/contact",
    });
    expect(JSON.stringify(record)).not.toContain(FIXTURE_EMAIL);
  });

  it("noop reporter accepts anything", () => {
    expect(() => noopErrorReporter.captureException(new Error("x"))).not.toThrow();
  });
});
