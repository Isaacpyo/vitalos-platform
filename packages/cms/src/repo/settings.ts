/**
 * Site settings facts published by the owner (Companies House record, verified 2026-10-11).
 * Nothing else is stated here: no town, VAT number, phone, social link or logo. A missing fact is
 * omitted, never invented.
 */
import type { SiteSettingsView } from "../content/types";

export const repoSettingsFacts = {
  legalName: "Vitalos Technologies Limited",
  companyNumber: "16696895",
  registeredAddress: "114 High Street, Bentley, Doncaster, England, DN5 0AT",
  contactEmail: "support@vitalos.co.uk",
} as const satisfies Pick<
  SiteSettingsView,
  "legalName" | "companyNumber" | "registeredAddress" | "contactEmail"
>;
