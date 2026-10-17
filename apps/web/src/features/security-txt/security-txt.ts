/**
 * `/.well-known/security.txt` (RFC 9116; finding B8, 17 Oct 2026). Pure: the contact address
 * comes from site settings (a security address when one is published, otherwise the contact
 * address, which the Master FAQ, TRU-14, names as the security contact) and the expiry is one
 * year after `now`. Nothing else is stated: no policy, encryption key or hiring line exists.
 */
export interface SecurityTxtInput {
  siteUrl: string;
  /** `securityEmail ?? contactEmail` from site settings. */
  contactEmail: string | undefined;
  now: Date;
}

export const SECURITY_TXT_PATH = "/.well-known/security.txt";

/** One year after `now`, at the same instant (RFC 9116 §2.5.5 recommends less than a year). */
export function securityTxtExpiry(now: Date): Date {
  const expires = new Date(now.getTime());
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  // Stay just under a year, as the RFC recommends.
  expires.setUTCDate(expires.getUTCDate() - 1);
  return expires;
}

/** The file body, or null when there is no contact to publish (the route then answers 404). */
export function buildSecurityTxt({ siteUrl, contactEmail, now }: SecurityTxtInput): string | null {
  const email = contactEmail?.trim();
  if (!email) return null;
  const expires = securityTxtExpiry(now).toISOString().replace(/\.\d{3}Z$/, ".000Z");
  return [
    `Contact: mailto:${email}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Canonical: ${new URL(SECURITY_TXT_PATH, siteUrl).toString()}`,
    "",
  ].join("\n");
}
