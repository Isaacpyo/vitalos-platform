import { describe, expect, it } from "vitest";
import { chatBody, handoffBody } from "./api";
import { parseStoredSettings, relaySettingsSchema } from "./settings";

describe("settings schema", () => {
  it("fills defaults and rejects retired models and bad hours", () => {
    const s = parseStoredSettings({});
    expect(s.model).toBe("deepseek-flash");
    expect(s.confidenceThreshold).toBe(0.55);
    expect(s.suggestedQuestions).toHaveLength(4);
    expect(relaySettingsSchema.safeParse({ model: "deepseek-reasoner" }).success).toBe(false);
    expect(
      relaySettingsSchema.safeParse({ businessHours: { start: "18:00", end: "09:00" } }).success,
    ).toBe(false);
    expect(
      relaySettingsSchema.safeParse({ reminderMinutes: 30, secondReminderMinutes: 10 }).success,
    ).toBe(false);
    expect(parseStoredSettings({ model: "deepseek-chat" }).model).toBe("deepseek-flash");
  });
});

describe("api schemas", () => {
  it("cleans control characters and enforces lengths", () => {
    const parsed = chatBody.parse({
      conversationId: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      text: "  hi\u202Ethere  ",
      pageUrl: "https://vitalos.co.uk/",
    });
    expect(parsed.text).toBe("hithere");
    expect(
      chatBody.safeParse({
        conversationId: crypto.randomUUID(),
        clientMessageId: crypto.randomUUID(),
        text: "x".repeat(2001),
        pageUrl: "https://vitalos.co.uk/",
      }).success,
    ).toBe(false);
  });

  it("hand-off requires consent and a valid email with field messages", () => {
    const r = handoffBody.safeParse({
      conversationId: crypto.randomUUID(),
      trigger: "not_helpful",
      name: " ",
      email: "nope",
      consent: false,
      noticeVersion: "2026-10",
    });
    expect(r.success).toBe(false);
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages).toContain("Enter your name");
    expect(messages).toContain("Enter a valid email address");
    expect(messages).toContain("Tick the box so we can contact you about this enquiry");
  });
});
