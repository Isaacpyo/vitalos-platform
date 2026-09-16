import { describe, expect, it } from "vitest";
import { enquirySchema } from "./index";
describe("enquirySchema", () => {
  it("rejects untrusted incomplete input", () =>
    expect(enquirySchema.safeParse({ email: "bad" }).success).toBe(false));
  it("accepts explicit consent", () =>
    expect(
      enquirySchema.safeParse({
        name: "Test Person",
        email: "test@example.invalid",
        message: "Clearly artificial fixture message.",
        consent: true,
      }).success,
    ).toBe(true));
});
