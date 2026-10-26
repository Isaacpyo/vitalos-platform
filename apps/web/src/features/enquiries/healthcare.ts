import { healthcareNeeds, isHealthcareIntent } from "@vitalos/validation/enquiry";
import type {
  HealthcareDetails,
  HealthcareIntent,
  HealthcareNeed,
  HealthcareOrganisationType,
} from "@vitalos/validation/enquiry";

/**
 * Health & Care enquiries (Website Build Pack, 25 Oct 2026): the form's labels, the needs each
 * intent preselects, and the `details` stored with the enquiry. No framework imports, so the form
 * (client) and the notification email (server) share the same wording.
 */

/** The tag every healthcare enquiry carries, derived on the server from the intent. */
export const HEALTHCARE_TAG = "healthcare";

export const healthcareOrganisationTypeLabels: Record<HealthcareOrganisationType, string> = {
  "private-clinic-or-hospital": "Private clinic or hospital",
  "gp-practice-or-pcn": "GP practice or PCN",
  "nhs-trust": "NHS trust",
  "courier-or-pharmacy": "Courier or pharmacy",
  "health-tech-supplier": "Health-tech supplier",
  other: "Other",
};

export const healthcareNeedLabels: Record<HealthcareNeed, string> = {
  "inbox-and-referrals": "Inbox and referrals",
  letters: "Letters",
  "coding-and-billing": "Coding and billing",
  "systems-integration": "Systems integration",
  "nhs-assurance": "NHS assurance",
  "medical-logistics": "Medical logistics",
  "design-partner": "Design partner",
};

/** The notice above the message field of a healthcare enquiry (Part 2, word for word). */
export const noPatientInformationNotice = "Please don't include any patient information.";

/** The needs an offer's enquiry preselects, by offer slug. */
const needsByOffer: Readonly<Record<string, readonly HealthcareNeed[]>> = {
  "nhs-assurance-readiness": ["nhs-assurance"],
  "medical-logistics-digitisation": ["medical-logistics"],
  "systems-integration": ["systems-integration"],
};

/**
 * The needs ticked when the form opens. `healthcare-audit` preselects the first three needs and
 * `healthcare-partner` preselects Design partner (Part 2); an enquiry from a Health & Care offer
 * preselects that offer's need instead.
 */
export function preselectedNeeds(
  intent: HealthcareIntent,
  offerSlug?: string,
): readonly HealthcareNeed[] {
  if (intent === "healthcare-partner") return ["design-partner"];
  return (offerSlug && needsByOffer[offerSlug]) || healthcareNeeds.slice(0, 3);
}

export interface EnquiryDetailsRecord {
  tags?: readonly string[];
  healthcare?: HealthcareDetails;
}

/**
 * What is stored in `enquiries.details`: the tags (derived here from the intent, never sent by
 * the browser) and the healthcare answers. Empty for every other intent.
 */
export function enquiryDetailsFor(enquiry: {
  intent: string;
  healthcare?: HealthcareDetails | undefined;
}): EnquiryDetailsRecord {
  if (!isHealthcareIntent(enquiry.intent)) return {};
  return {
    tags: [HEALTHCARE_TAG],
    ...(enquiry.healthcare ? { healthcare: enquiry.healthcare } : {}),
  };
}
