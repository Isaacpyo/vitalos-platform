/**
 * Legal pages the owner has approved for publication from the repo.
 *
 * To add another approved legal page (acceptable-use): write its `LegalPageView`
 * here and add it to `approvedLegalPages`. The draft skeletons in `../draft/content/legal.ts` are
 * never served by the repo source.
 */
import type { LegalPageView } from "../content/types";
import { h2, p, pLink, richText, seo, ul } from "../draft/build";

/** Version the contact form records consent against. Must equal ENQUIRY_PRIVACY_NOTICE_VERSION. */
export const PRIVACY_NOTICE_VERSION = "2026-10-relay";

const privacy: LegalPageView = {
  id: "legalPage-privacy",
  slug: "privacy",
  title: "Privacy notice",
  version: PRIVACY_NOTICE_VERSION,
  effectiveDate: "2026-10-15",
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
    h2("Relay, our website assistant"),
    p(
      "Our website has an optional chat assistant, Relay. Relay answers questions about Vitalos using an AI model and the information published on this website. If you ask, it passes the conversation to a member of our team.",
    ),
    p(
      "When you use Relay we collect what you type, the page you are on, the page that referred you, any campaign tags in the link you followed, your browser type and approximate country, and a one-way hash of your IP address that we use to prevent abuse. If you ask to talk to a person, we also collect your name, email address and, optionally, your organisation, with your consent. Relay stores a conversation reference in your browser only after you send your first message, so the conversation can continue as you move between pages.",
    ),
    p(
      "Relay sends your messages to DeepSeek, our AI model provider, to generate answers. Before anything is sent, we remove email addresses, phone numbers, postcodes, account and card numbers and similar identifiers, and we never send your name, email address or organisation. DeepSeek processes these redacted messages in the People's Republic of China, which has no UK adequacy decision. Please do not type sensitive personal information into Relay.",
    ),
    p(
      "We use Relay conversations to answer your question, to let our team reply if you ask for a person, and to keep the service secure. Our lawful basis is our legitimate interest in answering enquiries about our services and, when you ask for a person, your consent to us contacting you about that enquiry.",
    ),
    p(
      "We delete Relay conversations 90 days after the last message if you did not leave contact details, and 12 months after the last message if you did. You can delete a conversation at any time from the Relay menu.",
    ),
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
      "We use service providers who process your data on our behalf: Vercel (website hosting), Supabase (database), Resend (email delivery), Cloudflare (bot protection), DeepSeek (AI answers in Relay) and Microsoft Azure (our internal team console). We do not sell your personal data.",
    ),
    h2("International transfers"),
    p(
      "Some of these providers process personal data outside the UK, including in the United States. Where they do, the transfer is protected by UK adequacy regulations or the UK International Data Transfer Addendum with that provider. The exception is DeepSeek, which processes the redacted Relay messages described above in the People's Republic of China, which has no UK adequacy decision.",
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
    "How Vitalos Technologies Limited collects and uses personal data when you send an enquiry or use the Relay assistant on this website.",
  ),
};

/**
 * Cookies (owner direction, 15 Oct 2026: "add them"). Every statement is taken from the approved
 * privacy notice above; nothing new is claimed. The site sets no cookies of its own (no
 * analytics, advertising or consent cookies in the code).
 */
const cookies: LegalPageView = {
  id: "legalPage-cookies",
  slug: "cookies",
  title: "Cookies",
  version: PRIVACY_NOTICE_VERSION,
  effectiveDate: "2026-10-15",
  body: richText(
    "legal-cookies",
    h2("Cookies on this website"),
    p("We do not use analytics or advertising cookies on this website."),
    h2("Protecting the enquiry form"),
    p(
      "To protect the form from abuse we store a one-way hash of your IP address, and we use Cloudflare Turnstile to check that the enquiry is not from an automated bot.",
    ),
    h2("Personal data"),
    pLink(
      "How we collect and use personal data is set out in our ",
      "privacy notice",
      "/legal/privacy",
      ".",
    ),
    h2("Changes to this notice"),
    p(
      "If we change this notice we will publish the new version on this page with a new version number and effective date.",
    ),
  ),
  seo: seo(
    "Cookies",
    "How the Vitalos website uses cookies and protects the enquiry form: no analytics or advertising cookies, a hashed IP address and Cloudflare Turnstile.",
  ),
};

/**
 * The accessibility statement: the owner's approved draft of 15 Oct 2026, published as its note
 * directs. Sections 1 and 4 as written. Section 2 keeps only the claims the site's tests back up:
 * 400% zoom (the 320px reflow check on every route), keyboard access (focus and menu specs),
 * reduced motion (motion specs) and plain English (copy rules). Light and dark mode were removed,
 * because the site has no dark theme, and so were screen-reader and speech-recognition support,
 * because they have not been tested. Section 3 stays "not yet evaluated" with no target date, and
 * section 5 carries only the confirmed practices. support@ replaces the proposed accessibility@
 * mailbox, which does not exist yet. Relay is not live, so it is not offered as a contact.
 */
const accessibility: LegalPageView = {
  id: "legalPage-accessibility",
  slug: "accessibility",
  title: "Accessibility statement",
  version: PRIVACY_NOTICE_VERSION,
  effectiveDate: "2026-10-15",
  body: richText(
    "legal-accessibility",
    h2("Our commitment"),
    p(
      "We want everyone to be able to use vitalos.co.uk, whatever their ability or the technology they use. We design and build the site to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.",
    ),
    p(
      "This statement covers every page on vitalos.co.uk. It does not cover third-party sites we link to.",
    ),
    h2("Using the site"),
    p("We have designed the site so that you can:"),
    ul(
      "zoom to 400% without text disappearing or the page scrolling sideways",
      "reach every link, menu and form with a keyboard alone",
      "use the site with reduced motion, if your device asks for it",
      "read text written in plain English",
    ),
    pLink(
      "",
      "AbilityNet",
      "https://mcmw.abilitynet.org.uk/",
      " has advice on making your device easier to use.",
    ),
    h2("Compliance status"),
    p(
      "The site has not been fully evaluated against WCAG 2.2 AA yet. We plan to complete an evaluation, and we will update this statement with the results.",
    ),
    p(
      "Some features rely on services we do not fully control, including Cloudflare Turnstile bot protection on forms.",
    ),
    h2("Feedback and contact"),
    p(
      "If something on the site is hard to use, or you need information in another format (such as accessible PDF, large print or plain text), please tell us:",
    ),
    ul("email support@vitalos.co.uk", "use the Talk to Vitalos form on our contact page"),
    p("Tell us the page address and what went wrong. We will reply within 5 working days."),
    pLink(
      "If you are not happy with our response, you can contact the ",
      "Equality Advisory and Support Service (EASS)",
      "https://www.equalityadvisoryservice.com/",
      ".",
    ),
    h2("How we keep it accessible"),
    p("This statement was prepared on 15 October 2026. To keep the site accessible, we:"),
    ul(
      "check colour contrast in our design tokens",
      "run automated accessibility checks on every change before it goes live",
      "test new templates and features with a keyboard before launch",
      "review this statement at least once a year, and after any major change",
    ),
  ),
  seo: seo(
    "Accessibility statement",
    "How accessible vitalos.co.uk is: our WCAG 2.2 AA commitment, how you can use the site, its compliance status and how to tell us about a problem.",
  ),
};

/**
 * Website terms of use: the owner's approved draft of 15 Oct 2026 ("both approve, no blocker").
 * The placeholders are filled with facts the site already publishes: the legal identity from the
 * privacy notice, and support@vitalos.co.uk for legal notices and security reports (the security
 * contact the owner chose). The proposed legal@ and security@ mailboxes do not exist yet.
 */
const terms: LegalPageView = {
  id: "legalPage-terms",
  slug: "terms",
  title: "Website terms of use",
  version: PRIVACY_NOTICE_VERSION,
  effectiveDate: "2026-10-15",
  body: richText(
    "legal-terms",
    h2("1. About us and these terms"),
    p(
      "1.1 vitalos.co.uk (the site) is run by Vitalos Technologies Limited, a company registered in England and Wales under company number 16696895, with its registered office at 114 High Street, Bentley, Doncaster, England, DN5 0AT (Vitalos, we, us, our).",
    ),
    p(
      "1.2 These terms set out the rules for using the site, including Insights, Careers and Relay, our website assistant. By using the site you agree to them. If you do not agree, please do not use the site.",
    ),
    p(
      "1.3 These terms do not cover any consulting, engineering or other services we provide. Those are governed by a separate written agreement signed with each client.",
    ),
    pLink(
      "1.4 You can contact us at support@vitalos.co.uk or through the ",
      "Talk to Vitalos form",
      "/contact",
      ".",
    ),
    h2("2. Using our site"),
    p(
      "2.1 The site is free to use. We may change, suspend or withdraw any part of it at any time without notice. We do not promise it will always be available or free of errors.",
    ),
    p("2.2 You must not:"),
    ul(
      "use the site in any way that breaks the law or infringes anyone else's rights",
      "try to gain unauthorised access to the site, its servers or any connected system",
      "introduce viruses, malware or other harmful code",
      "attack the site through denial-of-service or similar methods",
      "scrape, harvest or bulk-download content by automated means, except by search engines and assistants that follow our robots.txt",
      "bypass bot protection, rate limits or other security measures",
      "impersonate anyone, or submit false or misleading information",
      "send unsolicited marketing through our forms or Relay",
    ),
    p(
      "2.3 We may block access to the site, or remove anything you submit, if we reasonably believe you have broken these terms. Attacks on the site may be reported to the authorities.",
    ),
    h2("3. Intellectual property"),
    p(
      "3.1 We, or our licensors, own all intellectual property rights in the site and its content, including text, design, graphics, code, the Vitalos name and logo, and Insights and Labs material.",
    ),
    p(
      "3.2 You may view, print and share pages for your own information or internal business use, as long as you credit Vitalos and link back to the source page. You must not change our content, remove our notices, or use any part of it for commercial purposes without our written permission.",
    ),
    p(
      "3.3 You must not use the Vitalos name, logo or brand in a way that suggests we endorse you or are connected with you.",
    ),
    h2("4. Information on the site"),
    p(
      "4.1 Content on the site, including Insights articles, Labs material and case studies, is general information only. It is not professional, technical, legal or financial advice for your situation. Please get advice specific to your circumstances before acting on it.",
    ),
    p(
      "4.2 We try to keep the site accurate and up to date, but we do not promise that it is complete, accurate or current.",
    ),
    p(
      "4.3 Nothing on the site is an offer to provide services. Any engagement starts only when we and the client sign a written agreement. Descriptions of our practices, solutions and offers may change.",
    ),
    h2("5. What you send us"),
    p(
      "5.1 Enquiries. When you contact us through a form, please give accurate information and do not include confidential or sensitive information we have not asked for. Sending an enquiry does not create a client relationship or any duty of confidentiality beyond what the law requires.",
    ),
    pLink(
      "5.2 Job applications. If you apply for a role through Careers, you confirm that the information and CV you provide are accurate and yours to share. Applying does not create a contract or a promise of employment. Our ",
      "privacy notice",
      "/legal/privacy",
      " explains how we handle and keep application data.",
    ),
    pLink(
      "5.3 Relay, our website assistant. Relay is an AI assistant. Its answers are generated automatically from information we publish and may be incomplete or wrong. They are not advice, a quote or a commitment by Vitalos. Do not rely on them for decisions, and ask for a person from the team if you need a firm answer. Please do not share personal, confidential or sensitive information in the chat. We may keep and review conversations to run and improve the service, as set out in our ",
      "privacy notice",
      "/legal/privacy",
      ".",
    ),
    p(
      "5.4 Ideas or feedback you send us may be used by us without obligation to you, unless we have agreed otherwise in writing.",
    ),
    h2("6. Links and security"),
    p(
      "6.1 Links to other websites are provided for information only. We have no control over those sites and are not responsible for their content, products or privacy practices.",
    ),
    p(
      "6.2 You may link to our home page or any public page, as long as you do it fairly and legally and do not suggest any endorsement that does not exist. You must not frame the site on another website. We may withdraw linking permission at any time.",
    ),
    p(
      "6.3 We take reasonable steps to keep the site secure, but we cannot guarantee it is free from bugs or viruses. Please use your own virus protection. To report a security issue, email support@vitalos.co.uk.",
    ),
    h2("7. Our liability, privacy and cookies"),
    p(
      "7.1 Nothing in these terms limits or excludes our liability for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot be limited or excluded by law.",
    ),
    p(
      "7.2 If you use the site as a consumer, we are responsible only for loss or damage you suffer that is a foreseeable result of our breach of these terms or our failure to use reasonable care. We provide the site for domestic and private use, so we are not liable for any loss of profit, business or business opportunity. Your legal rights as a consumer are not affected.",
    ),
    p(
      "7.3 If you use the site for business, we exclude all implied conditions, warranties and representations about the site and its content to the fullest extent the law allows. We are not liable, whether in contract, tort (including negligence), breach of statutory duty or otherwise, for any loss or damage arising from use of, or inability to use, the site or reliance on its content (including Relay's answers), or for any loss of profits, revenue, business, contracts, data, goodwill or anticipated savings, or any indirect or consequential loss.",
    ),
    pLink(
      "7.4 Our ",
      "privacy notice",
      "/legal/privacy",
      " explains how we use personal data collected through the site.",
    ),
    pLink(
      "Our ",
      "cookie notice",
      "/legal/cookies",
      " explains what we store on your device and why.",
    ),
    h2("8. Changes, law and contact"),
    p(
      "8.1 We may update these terms from time to time. The version on this page when you use the site applies, so please check it now and then. The effective date at the top shows when it last changed.",
    ),
    p(
      "8.2 If any part of these terms is found unenforceable, the rest stays in force. If we do not enforce a right straight away, we can still enforce it later.",
    ),
    p(
      "8.3 These terms are governed by the law of England and Wales. The courts of England and Wales have exclusive jurisdiction over any dispute, except that a consumer living in Scotland or Northern Ireland may also bring proceedings there.",
    ),
    p("8.4 Questions about these terms: support@vitalos.co.uk."),
  ),
  seo: seo(
    "Website terms of use",
    "Rules for using vitalos.co.uk, including Insights, Careers and Relay: using the site, intellectual property, what you send us, liability and governing law.",
  ),
};

export const approvedLegalPages: readonly LegalPageView[] = [
  privacy,
  cookies,
  terms,
  accessibility,
];
