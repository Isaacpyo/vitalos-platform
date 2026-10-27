import type { RelayStore } from "../db/types";
import type { VisitorMailer } from "../services/context";

type MailInput = Parameters<VisitorMailer["send"]>[0];

/**
 * The outbox is an audit trail, not a second way in: the single-use resume token in the link
 * (`?relay=resume&t=...`) is replaced before the email is stored.
 */
export function scrubForLog<T extends { html: string; text: string }>(email: T): T {
  const scrub = (v: string) => v.replace(/([?&](?:amp;)?t=)[^&"'<>\s]+/g, "$1[removed]");
  return { ...email, html: scrub(email.html), text: scrub(email.text) };
}

/**
 * Visitor email delivery. `LogVisitorMailer` stores the email in relay.email_outbox and sends
 * nothing (the default until a sending domain is verified). `ResendVisitorMailer` sends through
 * Resend and records the send in the same outbox as an audit trail.
 */
export class LogVisitorMailer implements VisitorMailer {
  constructor(private readonly store: RelayStore) {}

  async send(input: MailInput): Promise<"logged"> {
    const { inlineImages: _images, ...email } = input;
    void _images;
    await this.store.insertEmail({
      ...scrubForLog(email),
      provider: "log",
      status: "logged",
      providerMessageId: null,
    });
    return "logged";
  }
}

export class ResendVisitorMailer implements VisitorMailer {
  constructor(
    private readonly options: {
      store: RelayStore;
      apiKey: string;
      from: string;
      fetch?: typeof fetch;
      /** Outside production only @vitalos.co.uk recipients receive real email (build prompt 0.1). */
      allowedRecipient?: (to: string) => boolean;
    },
  ) {}

  async send(input: MailInput): Promise<"sent" | "logged" | "failed"> {
    const { inlineImages = [], ...email } = input;
    if (this.options.allowedRecipient && !this.options.allowedRecipient(input.to)) {
      await this.options.store.insertEmail({
        ...scrubForLog(email),
        provider: "log",
        status: "logged",
        providerMessageId: null,
      });
      return "logged";
    }
    let status: "sent" | "failed" = "failed";
    let providerMessageId: string | null = null;
    try {
      const res = await (this.options.fetch ?? fetch)("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.options.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          // Automated mail, named so the Super Admin inbox recognises it if it comes back (ADR-046).
          headers: {
            "Auto-Submitted": "auto-generated",
            "X-Auto-Response-Suppress": "All",
            "X-Vitalos-Notification": "relay.visitor-email",
          },
          attachments: inlineImages.map((img) => ({
            filename: img.filename,
            content: img.base64,
            content_id: img.contentId,
          })),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        status = "sent";
        const body = (await res.json().catch(() => ({}))) as { id?: unknown };
        providerMessageId = typeof body.id === "string" ? body.id : null;
      }
    } catch {
      status = "failed";
    }
    await this.options.store.insertEmail({
      ...scrubForLog(email),
      provider: "resend",
      status,
      providerMessageId,
    });
    return status;
  }
}
