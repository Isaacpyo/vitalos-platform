import type { RelayStore } from "../db/types";
import type { VisitorMailer } from "../services/context";

type MailInput = Parameters<VisitorMailer["send"]>[0];

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
      ...email,
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
        ...email,
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
      ...email,
      provider: "resend",
      status,
      providerMessageId,
    });
    return status;
  }
}
