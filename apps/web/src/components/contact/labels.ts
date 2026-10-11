import { contactIntents } from "@vitalos/cms";
import type { ContactIntent, ContactRouteView } from "@vitalos/cms";
import { enquiryTimeframes } from "@vitalos/validation/enquiry";
import type { EnquiryTimeframe } from "@vitalos/validation/enquiry";

/**
 * Interface text for the enquiry form: plain labels for form controls, not marketing copy.
 * Intent labels come from the CMS contact routes when editors have set them; these are the
 * fallback so every intent always has a readable label.
 */
export const intentFallbackLabels: Record<ContactIntent, string> = {
  project: "A new project",
  offer: "One of our offers",
  engineering: "Engineering support",
  ai: "AI",
  "managed-services": "Managed services",
  procurement: "Procurement",
  partnership: "A partnership",
  careers: "Careers",
  general: "Something else",
};

/**
 * PROVISIONAL labels for the provisional timeframe bands in `@vitalos/validation`. The owner
 * must approve the final bands (stage-1 plan section 6); only these labels change then.
 */
export const timeframeLabels: Record<EnquiryTimeframe, string> = {
  immediately: "As soon as possible",
  "within-3-months": "Within 3 months",
  "within-6-months": "Within 6 months",
  exploring: "Still exploring",
};

export interface SelectOption {
  value: string;
  label: string;
}

export function buildIntentOptions(routes: readonly ContactRouteView[] = []): SelectOption[] {
  return contactIntents.map((value) => ({
    value,
    label: routes.find((route) => route.intent === value)?.label ?? intentFallbackLabels[value],
  }));
}

export const timeframeOptions: SelectOption[] = enquiryTimeframes.map((value) => ({
  value,
  label: timeframeLabels[value],
}));
