/**
 * Site settings facts published by the owner (Companies House record, verified 2026-10-11; social
 * profiles as linked from the enquiry email and the Super Admin company facts, shown on the site
 * by owner direction, 15 Oct 2026). Nothing else is stated here: no town, VAT number, phone or
 * logo. A missing fact is omitted, never invented.
 */
import type { SiteSettingsView } from "../content/types";

export const repoSettingsFacts = {
  legalName: "Vitalos Technologies Limited",
  companyNumber: "16696895",
  registeredAddress: "114 High Street, Bentley, Doncaster, England, DN5 0AT",
  contactEmail: "support@vitalos.co.uk",
  social: [
    { label: "LinkedIn", href: "https://www.linkedin.com/company/vitalos" },
    { label: "X", href: "https://x.com/vitalos" },
  ],
} as const satisfies Pick<
  SiteSettingsView,
  "legalName" | "companyNumber" | "registeredAddress" | "contactEmail" | "social"
>;
