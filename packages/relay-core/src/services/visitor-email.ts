import { cleanLine, cleanMultiline, renderEmail } from "@vitalos/email-layout";
import type { EmailDocument, InlineImage } from "@vitalos/email-layout";
import { firstName, hmacHex, randomToken } from "../util/tokens";
import type { RelayContext } from "./context";

/** Owner-published company facts (packages/cms/src/repo/settings.ts), for the email footer. */
const COMPANY = {
  legalName: "Vitalos Technologies Limited",
  companyNumber: "16696895",
  registeredOffice: "114 High Street, Bentley, Doncaster, England, DN5 0AT",
  website: "https://vitalos.co.uk",
  supportEmail: "support@vitalos.co.uk",
} as const;

export const RESUME_TTL_DAYS = 7;

/** Creates a single-use resume token (stored as an HMAC, 7-day expiry) and returns the raw token. */
export async function createResumeToken(
  ctx: RelayContext,
  conversationId: string,
): Promise<string> {
  const token = randomToken();
  const expires = new Date(ctx.deps.now().getTime() + RESUME_TTL_DAYS * 86_400_000).toISOString();
  await ctx.deps.store.insertResumeToken(
    hmacHex(ctx.config.tokenPepper, `resume:${token}`),
    conversationId,
    expires,
  );
  return token;
}

export function resumeTokenHash(ctx: RelayContext, token: string): string {
  return hmacHex(ctx.config.tokenPepper, `resume:${token}`);
}

/**
 * "Temitope from Vitalos replied" (section 7.4). Off by default: RELAY_VISITOR_EMAILS_ENABLED and
 * the Settings switch must both be on, and turning it on in production needs owner approval.
 */
export function visitorReplyEmail(input: {
  visitorName: string;
  adminName: string;
  reply: string;
  resumeUrl: string;
  privacyUrl: string;
}): { subject: string; html: string; text: string; inlineImages: InlineImage[] } {
  const admin = firstName(cleanLine(input.adminName)) || "The Vitalos team";
  const subject = `${admin} from Vitalos replied`;
  const doc: EmailDocument = {
    title: subject,
    preheader: cleanLine(input.reply).slice(0, 90),
    headerLabel: "Relay",
    blocks: [
      { type: "heading", text: `${admin} replied to your conversation.` },
      {
        type: "text",
        text: `Hello ${firstName(cleanLine(input.visitorName)) || "there"}, you asked Relay for a person on vitalos.co.uk. Here is the reply.`,
      },
      { type: "quote", text: cleanMultiline(input.reply).slice(0, 4000) },
      { type: "button", label: "Continue the conversation", url: input.resumeUrl },
      {
        type: "text",
        tone: "muted",
        text: `The link opens this conversation on our website and works once, for ${RESUME_TTL_DAYS} days. You can reply to this email only through that link. Privacy notice: ${input.privacyUrl}`,
      },
    ],
    footer: {
      social: [],
      company: COMPANY,
      notice: "You get this email because you asked Vitalos to contact you about your enquiry.",
    },
  };
  const rendered = renderEmail(doc);
  return { subject, html: rendered.html, text: rendered.text, inlineImages: rendered.inlineImages };
}
