import { describe, expect, it } from "vitest";
import { scrubForLog } from "./mailer";

describe("scrubForLog", () => {
  it("removes the resume token from stored emails and keeps everything else", () => {
    const email = {
      subject: "Temitope from Vitalos replied",
      html: '<a href="https://www.vitalos.co.uk/?relay=resume&amp;t=abcDEF123_-xyz">Continue</a>',
      text: "Continue: https://www.vitalos.co.uk/?relay=resume&t=abcDEF123_-xyz\nThanks",
    };
    const stored = scrubForLog(email);
    expect(stored.html).not.toContain("abcDEF123");
    expect(stored.text).not.toContain("abcDEF123");
    expect(stored.text).toContain("relay=resume&t=[removed]\nThanks");
    expect(stored.subject).toBe(email.subject);
  });
});
