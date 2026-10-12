import { NotificationError } from "../domain/ports";
import type { EnquiryLogger, NotificationMessage, Notifier } from "../domain/ports";
import type { InlineImage } from "@vitalos/email-layout";
import { SIMPLE_ADDRESS, cleanLine, renderEnquiryNotification } from "./enquiry-notification-email";

/**
 * Email notifier adapters (`EMAIL_PROVIDER=postmark|resend`). They only tell the internal
 * recipient (`ENQUIRY_NOTIFICATION_TO`) that an enquiry arrived; the database stays the record.
 * The message is multipart/alternative (plain text and HTML), rendered by
 * `enquiry-notification-email.ts`.
 *
 * Privacy rules:
 * - The subject carries the intent, the enquirer's name and organisation and the reference; the
 *   HTML preheader carries the timeframe and the start of the goal. This lets the internal
 *   recipient triage from the inbox (owner decision 2026-10-12, ADR-019 status note).
 * - The body carries the enquiry for the internal recipient, as the notifier design intends.
 * - Logs carry the provider, kind, reference, correlation id and an HTTP status. Never an address,
 *   a name, the goal, the API key, or any provider response body (providers can echo the request).
 *
 * Error mapping (drives the outbox retry logic in `dispatchOutbox`):
 * - 2xx: sent.
 * - Network failure, timeout, 408, 429 and 5xx: retryable.
 * - 409 (Resend: identical idempotent request in flight): retryable.
 * - 3xx (redirects are not followed): permanent `email-redirect`, a misconfigured endpoint.
 * - Everything else (401/403 authentication, 400/422 validation, other 4xx): permanent.
 * - A message of kind `acknowledgement` (a customer receipt, not approved by the owner) is never
 *   sent: permanent failure.
 */

export interface EmailNotifierOptions {
  apiKey: string;
  /** Sender, as `address` or `Name <address>`. Must be a verified sender at the provider. */
  from: string;
  /** Internal recipient (`ENQUIRY_NOTIFICATION_TO`). */
  to: string;
  logger: EnquiryLogger;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export const DEFAULT_EMAIL_TIMEOUT_MS = 10_000;

interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

interface EmailContent {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Sent as inline attachments, referenced from the HTML by content id. */
  inlineImages: InlineImage[];
  replyTo: string | undefined;
  idempotencyKey: string;
}

abstract class EmailNotifier implements Notifier {
  protected abstract readonly provider: "postmark" | "resend";
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(protected readonly options: EmailNotifierOptions) {
    this.doFetch = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_EMAIL_TIMEOUT_MS;
  }

  protected abstract request(content: EmailContent): ProviderRequest;

  async send(message: NotificationMessage): Promise<void> {
    const base = {
      provider: this.provider,
      kind: message.kind,
      reference: message.enquiry.reference,
      correlationId: message.correlationId,
    };
    if (message.kind !== "internal-notification") {
      // Customer acknowledgements are reserved until the owner approves them.
      this.options.logger.warn("notification.email.unsupported_kind", base);
      throw new NotificationError("email-kind-unsupported", { retryable: false });
    }

    // Same cleaning as the template, so the Reply-To and the reply button always agree.
    const workEmail = cleanLine(message.enquiry.workEmail);
    const rendered = renderEnquiryNotification(message);
    const request = this.request({
      from: this.options.from,
      to: this.options.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      inlineImages: rendered.inlineImages,
      replyTo: SIMPLE_ADDRESS.test(workEmail) ? workEmail : undefined,
      idempotencyKey: message.idempotencyKey,
    });

    let response: Response;
    try {
      response = await this.doFetch(request.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...request.headers,
        },
        body: JSON.stringify(request.body),
        // Manual: a redirect is returned as a 3xx response and treated as a permanent misconfiguration.
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      // Only the error class is kept: messages and causes can include request details.
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      const code = timedOut ? "email-timeout" : "email-network";
      this.options.logger.warn("notification.email.failed", { ...base, errorCode: code });
      throw new NotificationError(code, { retryable: true });
    }

    // The response body is never read or logged: providers can echo the request.
    void response.body?.cancel().catch(() => undefined);

    if (response.ok) {
      this.options.logger.info("notification.email.sent", { ...base, status: response.status });
      return;
    }

    const { code, retryable } =
      response.type === "opaqueredirect"
        ? { code: "email-redirect", retryable: false }
        : classifyStatus(response.status);
    this.options.logger.warn("notification.email.failed", {
      ...base,
      status: response.status,
      errorCode: code,
    });
    throw new NotificationError(code, { retryable });
  }
}

export function classifyStatus(status: number): { code: string; retryable: boolean } {
  // A redirect means the endpoint is wrong; retrying cannot help.
  if (status >= 300 && status < 400) return { code: "email-redirect", retryable: false };
  // Resend answers 409 while an identical idempotent request is still in flight.
  if (status === 409) return { code: "email-conflict", retryable: true };
  if (status === 429) return { code: "email-rate-limited", retryable: true };
  if (status === 408) return { code: "email-timeout", retryable: true };
  if (status >= 500) return { code: "email-provider-unavailable", retryable: true };
  if (status === 401 || status === 403) return { code: "email-auth-rejected", retryable: false };
  if (status === 400 || status === 422) return { code: "email-rejected", retryable: false };
  return { code: `email-http-${status}`, retryable: false };
}

/** https://postmarkapp.com/developer/api/email-api (single message, default outbound stream). */
export class PostmarkNotifier extends EmailNotifier {
  protected readonly provider = "postmark" as const;

  protected request(c: EmailContent): ProviderRequest {
    return {
      url: "https://api.postmarkapp.com/email",
      headers: { "X-Postmark-Server-Token": this.options.apiKey },
      body: {
        From: c.from,
        To: c.to,
        Subject: c.subject,
        TextBody: c.text,
        HtmlBody: c.html,
        Attachments: c.inlineImages.map((img) => ({
          Name: img.filename,
          Content: img.base64,
          ContentType: img.contentType,
          ContentID: `cid:${img.contentId}`,
        })),
        ...(c.replyTo ? { ReplyTo: c.replyTo } : {}),
      },
    };
  }
}

/** https://resend.com/docs/api-reference/emails/send-email (supports an Idempotency-Key header). */
export class ResendNotifier extends EmailNotifier {
  protected readonly provider = "resend" as const;

  protected request(c: EmailContent): ProviderRequest {
    return {
      url: "https://api.resend.com/emails",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Idempotency-Key": c.idempotencyKey,
      },
      body: {
        from: c.from,
        to: [c.to],
        subject: c.subject,
        text: c.text,
        html: c.html,
        attachments: c.inlineImages.map((img) => ({
          filename: img.filename,
          content: img.base64,
          content_type: img.contentType,
          content_id: img.contentId,
        })),
        ...(c.replyTo ? { reply_to: c.replyTo } : {}),
      },
    };
  }
}
