/**
 * Legal pages the owner has approved for publication from the repo.
 *
 * To add another approved legal page (cookies, terms, acceptable-use): write its `LegalPageView`
 * here and add it to `approvedLegalPages`. The draft skeletons in `../draft/content/legal.ts` are
 * never served by the repo source.
 */
import type { LegalPageView } from "../content/types";
import { h2, p, richText, seo } from "../draft/build";

/** Version the contact form records consent against. Must equal ENQUIRY_PRIVACY_NOTICE_VERSION. */
export const PRIVACY_NOTICE_VERSION = "2026-10";

const privacy: LegalPageView = {
  id: "legalPage-privacy",
  slug: "privacy",
  title: "Privacy notice",
  version: PRIVACY_NOTICE_VERSION,
  effectiveDate: "2026-10-11",
  body: richText(
    "legal-privacy",
    h2("Who we are"),
    p(
      "Vitalos Technologies Limited (company number 16696895), registered office 114 High Street, Bentley, Doncaster, England, DN5 0AT, is the controller of the personal data described in this notice. You can contact us about it at support@vitalos.co.uk.",
    ),
    h2("What we collect"),
    p(
      "When you send an enquiry through this website we collect your name, organisation, work email address, role (optional), what you are trying to achieve, your timeframe, an optional budget range, the page you enquired from and any campaign tags in the link you followed.",
    ),
    p(
      "To protect the form from abuse we store a one-way hash of your IP address, and we use Cloudflare Turnstile to check that the enquiry is not from an automated bot.",
    ),
    p("We do not use analytics or advertising cookies on this website."),
    h2("Why we use it"),
    p(
      "We use your details to reply to your enquiry and to discuss working together. Our lawful basis is our legitimate interest in responding to business enquiries and keeping our website secure.",
    ),
    p("We do not add you to marketing lists."),
    h2("How long we keep it"),
    p(
      "We keep enquiries for 24 months after our last contact with you, then delete them. If your enquiry leads to us working together, we keep the relevant details for as long as that relationship and our legal obligations require.",
    ),
    h2("Who we share it with"),
    p(
      "We use service providers who process your data on our behalf: Vercel (website hosting), Supabase (database), Resend (email delivery) and Cloudflare (bot protection). We do not sell your personal data.",
    ),
    h2("International transfers"),
    p(
      "Some of these providers process personal data outside the UK, including in the United States. Where they do, the transfer is protected by UK adequacy regulations or the UK International Data Transfer Addendum with that provider.",
    ),
    h2("Your rights"),
    p(
      "You can ask us to access, correct or delete your personal data, to restrict or object to how we use it, or to give you a copy. Email support@vitalos.co.uk. You also have the right to complain to the Information Commissioner's Office at ico.org.uk.",
    ),
    h2("Changes to this notice"),
    p(
      "If we change this notice we will publish the new version on this page with a new version number and effective date.",
    ),
  ),
  seo: seo(
    "Privacy notice",
    "How Vitalos Technologies Limited collects and uses personal data when you send an enquiry through this website.",
  ),
};

export const approvedLegalPages: readonly LegalPageView[] = [privacy];
