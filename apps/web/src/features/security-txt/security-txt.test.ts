import { describe, expect, it } from "vitest";
import { buildSecurityTxt, securityTxtExpiry } from "./security-txt";

const now = new Date("2026-10-17T06:00:00Z");

describe("security.txt (RFC 9116)", () => {
  it("publishes the contact, an expiry under a year away, the language and the canonical URL", () => {
    const body = buildSecurityTxt({
      siteUrl: "https://vitalos.co.uk",
      contactEmail: "support@vitalos.co.uk",
      now,
    });
    expect(body).toBe(
      [
        "Contact: mailto:support@vitalos.co.uk",
        "Expires: 2027-10-16T06:00:00.000Z",
        "Preferred-Languages: en",
        "Canonical: https://vitalos.co.uk/.well-known/security.txt",
        "",
      ].join("\n"),
    );
  });

  it("keeps the expiry in the future and less than a year away", () => {
    const expires = securityTxtExpiry(now).getTime();
    expect(expires).toBeGreaterThan(now.getTime());
    expect(expires - now.getTime()).toBeLessThan(365 * 24 * 60 * 60 * 1000);
  });

  it("publishes nothing without a contact address", () => {
    expect(buildSecurityTxt({ siteUrl: "https://x.invalid", contactEmail: " ", now })).toBeNull();
    expect(buildSecurityTxt({ siteUrl: "https://x.invalid", contactEmail: undefined, now })).toBeNull();
  });
});
