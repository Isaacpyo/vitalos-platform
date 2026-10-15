/**
 * Site settings facts published by the owner (Companies House record, verified 2026-10-11; social
 * profiles as linked from the enquiry email and the Super Admin company facts, shown on the site
 * by owner direction, 15 Oct 2026). Nothing else is stated here: no town, VAT number, phone or
 * logo. A missing fact is omitted, never invented.
 */
import type { SiteSettingsView } from "../content/types";

/*
 * Podcast listing URLs (footer "Podcast" block): PLACEHOLDERS set on the owner's instruction
 * (15 Oct 2026) until the shows exist. They do not resolve yet: replace both with the real show
 * URLs when the shows are live. Only https URLs on open.spotify.com / podcasts.apple.com are
 * accepted (validatePodcast).
 */
export const repoSettingsFacts = {
  legalName: "Vitalos Technologies Limited",
  companyNumber: "16696895",
  registeredAddress: "114 High Street, Bentley, Doncaster, England, DN5 0AT",
  contactEmail: "support@vitalos.co.uk",
  social: [
    { label: "LinkedIn", href: "https://www.linkedin.com/company/vitalos" },
    { label: "X", href: "https://x.com/vitalos" },
  ],
  podcast: {
    spotifyUrl: "https://open.spotify.com/show/vitalos",
    appleUrl: "https://podcasts.apple.com/gb/podcast/vitalos",
  },
} as const satisfies Pick<
  SiteSettingsView,
  "legalName" | "companyNumber" | "registeredAddress" | "contactEmail" | "social" | "podcast"
>;
