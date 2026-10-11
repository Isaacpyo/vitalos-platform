import { describe, expect, it } from "vitest";
import { redact, redactString, redactValue } from "./redact";

describe("redact (keys)", () => {
  it("masks credential and personal-data keys", () => {
    const out = redact({
      email: "a@b.co",
      contactEmail: "a@b.co",
      firstName: "Ada",
      full_name: "Ada L",
      name: "Ada",
      goal: "ship it",
      message: "hello",
      phone: "0",
      ipAddress: "1.2.3.4",
      apiKey: "k",
      "set-cookie": "x",
      Authorization: "Bearer abcdefghijkl",
      route: "/contact",
      hostname: "vitalos.example",
      filename: "a.pdf",
    });
    expect(out).toEqual({
      email: "[REDACTED]",
      contactEmail: "[REDACTED]",
      firstName: "[REDACTED]",
      full_name: "[REDACTED]",
      name: "[REDACTED]",
      goal: "[REDACTED]",
      message: "[REDACTED]",
      phone: "[REDACTED]",
      ipAddress: "[REDACTED]",
      apiKey: "[REDACTED]",
      "set-cookie": "[REDACTED]",
      Authorization: "[REDACTED]",
      route: "/contact",
      hostname: "vitalos.example",
      filename: "a.pdf",
    });
  });

  it("redacts nested objects and arrays and does not mutate the input", () => {
    const input = {
      request: { data: { email: "x@y.co", offerSlug: "cloud" } },
      list: [{ token: "t" }],
    };
    const out = redact(input);
    expect(out).toEqual({
      request: { data: { email: "[REDACTED]", offerSlug: "cloud" } },
      list: [{ token: "[REDACTED]" }],
    });
    expect(input.request.data.email).toBe("x@y.co");
  });

  it.each([
    "userMessage",
    "projectGoal",
    "userName",
    "username",
    "senderName",
    "lastName",
    "clientIp",
    "userIp",
    "sourceIp",
    "sourceIP",
    "client_ip",
    "ip",
    "x-forwarded-for",
    "X-Forwarded-Host",
    "x-real-ip",
    "cf-connecting-ip",
    "forwarded",
    "Forwarded",
    "body",
    "requestBody",
    "payload",
    "comments",
    "details",
    "notes",
  ])("redacts the personal-data key %s", (key) => {
    expect(redact({ [key]: "value" })).toEqual({ [key]: "[REDACTED]" });
  });

  it.each([
    "route",
    "hostname",
    "filename",
    "pathname",
    "serviceName",
    "eventName",
    "zip",
    "membership",
    "outcome",
    "offerSlug",
  ])("keeps the operational key %s", (key) => {
    expect(redact({ [key]: "value" })).toEqual({ [key]: "value" });
  });

  it("survives circular references", () => {
    const a: Record<string, unknown> = { route: "/" };
    a.self = a;
    expect(redact(a)).toEqual({ route: "/", self: "[Circular]" });
  });
});

describe("redact (robustness)", () => {
  it("redacts a 200 KB string without catastrophic backtracking", () => {
    for (const filler of ["a", "a@", "a.", "Bearer ", "a@a."]) {
      const huge = filler.repeat(Math.ceil(200_000 / filler.length));
      const started = performance.now();
      const out = redactString(huge);
      expect(performance.now() - started).toBeLessThan(100);
      expect(out.endsWith("[TRUNCATED]")).toBe(true);
      if (filler === "a") expect(out.length).toBeLessThan(9000);
    }
  });

  it("truncates long strings nested in records", () => {
    const out = redact({ context: "a".repeat(200_000) });
    expect((out.context as string).length).toBeLessThan(9000);
  });

  it("never throws on bigint, invalid dates, symbols, functions or throwing getters", () => {
    const hostile = {
      big: 10n,
      sym: Symbol("s"),
      fn: () => 1,
      when: new Date("not a date"),
      get boom(): string {
        throw new Error("getter exploded");
      },
      nested: new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("trap");
          },
        },
      ),
    };
    const out = redact(hostile);
    expect(out).toMatchObject({
      big: "10",
      sym: "Symbol(s)",
      fn: "[Function]",
      when: "[Invalid Date]",
      boom: "[Unreadable]",
      nested: "[Unreadable]",
    });
  });
});

describe("redact (values)", () => {
  it("masks email addresses and bearer tokens inside free text", () => {
    expect(redactString("failed for jane.doe+x@example.co.uk at /contact")).toBe(
      "failed for [REDACTED_EMAIL] at /contact",
    );
    expect(redactString("Authorization: Bearer abcdefghijklmnop")).toContain("Bearer [REDACTED]");
    expect(redactString("/contact?x=1")).toBe("/contact?x=1");
  });

  it("scrubs emails under non-sensitive keys", () => {
    expect(redact({ context: "mail a@b.co now" })).toEqual({
      context: "mail [REDACTED_EMAIL] now",
    });
    expect(redactValue(["a@b.co"])).toEqual(["[REDACTED_EMAIL]"]);
  });

  it("serialises Errors without stack and scrubs the message", () => {
    expect(redactValue(new Error("bad a@b.co"))).toEqual({
      type: "Error",
      message: "bad [REDACTED_EMAIL]",
    });
  });
});
