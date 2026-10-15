/**
 * Legal page skeletons. Every title says "DRAFT — not in force"; every fact the specs do not supply
 * is a bracketed placeholder for the owner and a qualified adviser (Stage 4 "Professional review";
 * Stage 5 §14.3; Stage 16 §2). The structure follows what Stage 6 §4 and Stage 10 §25 say the
 * website needs; nothing here is legal text.
 */
import type { LegalPageView } from "../../content/types";
import type { LegalSlug } from "../../routes";
import { h2, p, richText, seo, ul } from "../build";
import { cite, drafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import { draftId } from "../slugs";

export interface LegalDraft {
  view: LegalPageView;
  provenance: DraftProvenance;
}

export const DRAFT_LEGAL_MARK = "DRAFT — not in force";

/** Version label of every draft legal page. Not a date-based version: nothing is in force. */
export const DRAFT_LEGAL_VERSION = "draft-pending-approval";

const notInForce = p(
  "This page is a draft structure. It is not in force, it is not legal advice and it must be completed and reviewed by a qualified adviser before publication. Text in square brackets is a placeholder.",
);

const identity = ul(
  "Legal name: [Legal entity name]",
  "Company number: [Company number]",
  "Registered address: [Registered office address]",
  "Contact for this notice: [Contact email address]",
);

const legalSources = [
  cite(6, "4.1 Buyer-facing corporate record"),
  cite(6, "4.3 Corporate policies visible to buyers"),
  cite(4, "Professional review"),
];

function legalPage(
  slug: LegalSlug,
  name: string,
  description: string,
  body: ReturnType<typeof richText>,
  extra: Parameters<typeof drafted>[0],
): LegalDraft {
  return {
    view: {
      id: draftId("legalPage", slug),
      slug,
      title: `${name} (${DRAFT_LEGAL_MARK})`,
      version: DRAFT_LEGAL_VERSION,
      // No effective date: a draft is not in force. The page omits the date when it is not a date.
      effectiveDate: "",
      body,
      seo: { ...seo(`${name} (draft)`, description), noindex: true },
    },
    provenance: drafted(
      [...legalSources, ...extra],
      "All facts, lawful bases, retention periods, cookies, third parties and dates are placeholders: none are supplied by the owner yet.",
    ),
  };
}

export const legalDrafts: readonly LegalDraft[] = [
  legalPage(
    "privacy",
    "Privacy notice",
    "Draft structure for the Vitalos website privacy notice. Not in force.",
    richText(
      "legal-privacy",
      notInForce,
      h2("Who we are"),
      identity,
      h2("What we collect through this website"),
      p(
        "When you send an enquiry: your name, organisation, work email, role (optional), what you are trying to achieve, your timeframe, an optional budget range, and the page you enquired from. [Confirm the final field list.]",
      ),
      p(
        "[Describe any other personal data collected, for example through analytics, once chosen.]",
      ),
      h2("Why we use it and our lawful basis"),
      p("[Purposes and the lawful basis for each, to be confirmed by a qualified adviser.]"),
      p("We do not subscribe enquirers to marketing. [Confirm.]"),
      h2("How long we keep it"),
      p("[Retention period for enquiries, to be decided.]"),
      h2("Who we share it with"),
      p("[Third parties that process personal data for us, with purpose and location.]"),
      h2("International transfers"),
      p("[Whether any restricted transfer occurs, and the safeguard used.]"),
      h2("Your rights"),
      p(
        "[Your data protection rights and how to exercise them, including the right to complain to the Information Commissioner's Office.]",
      ),
      h2("Changes to this notice"),
      p("[Version history and effective date.]"),
    ),
    [
      cite(10, "25. Privacy & consent implementation"),
      cite(10, "21. Lead capture & enquiry architecture"),
      cite(16, "31. International data transfers"),
    ],
  ),
  legalPage(
    "cookies",
    "Cookie notice",
    "Draft structure for the Vitalos website cookie notice. Not in force.",
    richText(
      "legal-cookies",
      notInForce,
      h2("Who we are"),
      identity,
      h2("Cookies this website sets"),
      p(
        "[List each cookie or similar technology, its purpose and duration. To be completed once the analytics decision is made.]",
      ),
      h2("Strictly necessary and optional cookies"),
      p(
        "[Separate strictly necessary cookies from optional analytics or marketing technologies, and describe how consent is given and withdrawn where it is required.]",
      ),
      h2("Changes to this notice"),
      p("[Version history and effective date.]"),
    ),
    [cite(10, "25. Privacy & consent implementation")],
  ),
  legalPage(
    "terms",
    "Website terms of use",
    "Draft structure for the Vitalos website terms of use. Not in force.",
    richText(
      "legal-terms",
      notInForce,
      h2("Who we are"),
      identity,
      h2("Using this website"),
      p("[Terms that govern use of the website.]"),
      h2("Content on this website"),
      p("[Status of the content, intellectual property in it and permitted use.]"),
      h2("Liability"),
      p("[Limitations of liability, to be drafted by a qualified adviser.]"),
      h2("Governing law"),
      p("[Governing law and jurisdiction.]"),
      h2("Changes to these terms"),
      p("[Version history and effective date.]"),
    ),
    [cite(16, "27. Trade marks & brand IP")],
  ),
  legalPage(
    "acceptable-use",
    "Acceptable use policy",
    "Draft structure for the Vitalos acceptable use policy. Not in force.",
    richText(
      "legal-acceptable-use",
      notInForce,
      h2("Who we are"),
      identity,
      h2("Scope"),
      p("[Which websites, services or systems this policy covers.]"),
      h2("Acceptable and prohibited use"),
      p("[What users may and may not do.]"),
      h2("Reporting misuse"),
      p("[How to report misuse or a security concern.]"),
      h2("Changes to this policy"),
      p("[Version history and effective date.]"),
    ),
    [cite(8, "5. Core information architecture")],
  ),
  // The full accessibility statement, to be completed after the site has been evaluated
  // (Stage 8 §24). Production shows the Trust Centre's published commitment until then.
  legalPage(
    "accessibility",
    "Accessibility statement",
    "Draft structure for the Vitalos website accessibility statement. Not in force.",
    richText(
      "legal-accessibility",
      notInForce,
      h2("Who we are"),
      identity,
      h2("Compliance status"),
      p("[Conformance with WCAG 2.2 Level AA, stated only after an evaluation.]"),
      h2("Content that is not accessible"),
      p("[Known issues found by the evaluation, and when each will be fixed.]"),
      h2("How we tested this website"),
      p("[Evaluation method, who carried it out and the date.]"),
      h2("Feedback and contact"),
      p("[How to report an accessibility problem and what happens next.]"),
      h2("Changes to this statement"),
      p("[Version history and effective date.]"),
    ),
    [cite(8, "24. Accessibility architecture"), cite(10, "26. Accessibility QA programme")],
  ),
];
