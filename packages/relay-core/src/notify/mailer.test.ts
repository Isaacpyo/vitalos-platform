import { describe, expect, it, vi } from "vitest";
import type { RelayStore } from "../db/types";
import { ResendVisitorMailer, scrubForLog } from "./mailer";

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

describe("ResendVisitorMailer", () => {
  it("sends automated-mail headers and the inline images by content id", async () => {
    const insertEmail = vi.fn(() => Promise.resolve());
    const fetchFake = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: "re_1" }), { status: 200 })),
    );
    const mailer = new ResendVisitorMailer({
      store: { insertEmail } as unknown as RelayStore,
      apiKey: "test-key",
      from: "Vitalos <relay@vitalos.co.uk>",
      fetch: fetchFake,
    });
    const status = await mailer.send({
      to: "alex@example.test",
      subject: "Your conversation with Vitalos",
      html: "<p>Hi</p>",
      text: "Hi",
      conversationId: "conversation-example",
      inlineImages: [
        { contentId: "vitalos-logo", filename: "vitalos-logo-white.png", base64: "AA==" },
      ],
    });
    expect(status).toBe("sent");
    const [, init] = fetchFake.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      headers: Record<string, string>;
      attachments: Record<string, string>[];
    };
    expect(body.headers).toEqual({
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
      "X-Vitalos-Notification": "relay.visitor-email",
    });
    expect(body.attachments[0]).toMatchObject({ content_id: "vitalos-logo" });
  });
});
