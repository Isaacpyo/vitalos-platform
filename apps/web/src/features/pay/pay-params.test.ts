import { describe, expect, it } from "vitest";
import { normaliseInvoice, parsePayParams, payCheckoutUrl, payErrors } from "./pay-params";

describe("parsePayParams", () => {
  it("accepts well-formed invoice numbers, codes, errors and the cancelled flag", () => {
    expect(
      parsePayParams({
        invoice: "inv-2026-0001",
        code: "abcd-efgh",
        error: "paid",
        cancelled: "1",
      }),
    ).toEqual({ invoice: "INV-2026-0001", code: "ABCD-EFGH", error: "paid", cancelled: true });
    expect(parsePayParams({ code: "ABCD EFGH" }).code).toBe("ABCDEFGH");
  });

  it("drops anything outside the expected shape instead of echoing it", () => {
    expect(
      parsePayParams({
        invoice: "<script>alert(1)</script>",
        code: "0O1I-0O1I",
        error: "anything",
        cancelled: "yes",
      }),
    ).toEqual({ invoice: "", code: "", error: undefined, cancelled: false });
    expect(parsePayParams({ invoice: ["INV-2026-0002", "INV-2026-0003"] }).invoice).toBe(
      "INV-2026-0002",
    );
  });

  it("knows every error code the Super Admin endpoint sends", () => {
    expect(payErrors).toEqual(["not-found", "paid", "verification", "rate-limited", "unavailable"]);
    for (const error of payErrors) expect(parsePayParams({ error }).error).toBe(error);
  });
});

describe("helpers", () => {
  it("normalises invoice numbers", () => {
    expect(normaliseInvoice(" inv-2026-0042 ")).toBe("INV-2026-0042");
    expect(normaliseInvoice("INV-26-1")).toBe("");
    expect(normaliseInvoice(undefined)).toBe("");
  });

  it("builds the Super Admin checkout URL from its origin", () => {
    expect(payCheckoutUrl("https://admin.example.invalid")).toBe(
      "https://admin.example.invalid/pay/checkout/",
    );
  });
});
