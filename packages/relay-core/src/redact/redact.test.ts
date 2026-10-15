import { describe, expect, it } from "vitest";
import { ibanValid, luhnValid, nhsValid, redact } from "./redact";

describe("redact", () => {
  it.each([
    ["email me at jane.doe@example.co.uk please", "email me at [email] please"],
    ["call 07700 900123 today", "call [phone] today"],
    ["call +44 7700 900123 or 020 7946 0958", "call [phone] or [phone]"],
    ["+1 (555) 010-9999 is my US number", "[phone] is my US number"],
    ["we are at SW1A 1AA and M1 1AE", "we are at [postcode] and [postcode]"],
    ["my NHS number is 943 476 5919", "my NHS number is [nhs-number]"],
    ["NI number AB 12 34 56 C", "NI number [ni-number]"],
    ["card 4111 1111 1111 1111 expires soon", "card [card] expires soon"],
    ["IBAN GB82 WEST 1234 5698 7654 32", "IBAN [bank]"],
    ["sort code 12-34-56 account 12345678", "sort code [bank]"],
  ])("redacts %j", (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it("leaves ordinary numbers, years and ISO references alone", () => {
    for (const text of [
      "ISO 27001 and 2026 budgets",
      "about 10 to 12 weeks",
      "version 2.4.1",
      "we have 300 staff",
      "ten-year-old system",
    ]) {
      expect(redact(text)).toBe(text);
    }
  });

  it("does not treat a random 16-digit number as a card or a non-checksummed NHS number as personal", () => {
    expect(redact("ref 1234 5678 9012 3456")).toBe("ref 1234 5678 9012 3456");
    expect(redact("order 123 456 7890")).toBe("order 123 456 7890");
  });

  it("validators", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(nhsValid("9434765919")).toBe(true);
    expect(nhsValid("1234567890")).toBe(false);
    expect(ibanValid("GB82WEST12345698765432")).toBe(true);
    expect(ibanValid("GB82WEST12345698765433")).toBe(false);
  });
});
