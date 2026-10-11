import { describe, expect, it } from "vitest";
import { redact } from "./redact";
import { isSafeRelativeRedirect } from "./url";

describe("redact", () => {
  it("masks sensitive keys and keeps the rest", () => {
    expect(redact({ apiToken: "abc", Authorization: "Bearer x", route: "/contact" })).toEqual({
      apiToken: "[REDACTED]",
      Authorization: "[REDACTED]",
      route: "/contact",
    });
  });
});

describe("isSafeRelativeRedirect", () => {
  it.each(["/", "/contact", "/what-we-do?x=1"])("accepts %s", (value) => {
    expect(isSafeRelativeRedirect(value)).toBe(true);
  });
  it.each([
    "//evil.invalid",
    "https://evil.invalid",
    "/\\evil",
    "contact",
    "/\t/evil.invalid",
    "/\n/evil.invalid",
    "/\r/evil.invalid",
    "/ok\u0000",
    "/\u001fx",
    "/\u007fx",
  ])("rejects %j", (value) => {
    expect(isSafeRelativeRedirect(value)).toBe(false);
  });
});
