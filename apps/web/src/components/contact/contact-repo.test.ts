import { createFixtureContentSource } from "@vitalos/cms/fixtures";
import { createRepoContentSource, repoContent, PRIVACY_NOTICE_VERSION } from "@vitalos/cms/repo";
import { describe, expect, it } from "vitest";
import { resolveContactPage } from "./contact-view";

describe("contact page over the repo content source", () => {
  it("offers the form when enquiries can be stored, recording against the published notice", async () => {
    const data = await resolveContactPage({
      source: createRepoContentSource(),
      enquiryPersistence: true,
      configuredPrivacyNoticeVersion: "2026-10",
    });
    expect(PRIVACY_NOTICE_VERSION).toBe("2026-10-analytics");
    expect(data.form).toEqual({ available: true, privacyNoticeVersion: "2026-10" });
    expect(data.settings.contactEmail).toBe("support@vitalos.co.uk");
  });

  it("falls back to the published notice version when none is configured", async () => {
    const data = await resolveContactPage({
      source: createRepoContentSource(),
      enquiryPersistence: true,
      configuredPrivacyNoticeVersion: undefined,
    });
    expect(data.form).toEqual({ available: true, privacyNoticeVersion: "2026-10-analytics" });
  });

  it("withholds the form, leaving the email alternative, while enquiries cannot be stored", async () => {
    const data = await resolveContactPage({
      source: createRepoContentSource(),
      enquiryPersistence: false,
      configuredPrivacyNoticeVersion: "2026-10",
    });
    expect(data.form).toEqual({ available: false });
    expect(data.settings.contactEmail).toBe("support@vitalos.co.uk");
  });

  it("falls back to the email alternative when no privacy document is published", async () => {
    const source = createFixtureContentSource({
      ...repoContent,
      documents: { ...repoContent.documents, legalPage: [] },
    });
    const data = await resolveContactPage({
      source,
      enquiryPersistence: true,
      configuredPrivacyNoticeVersion: "2026-10",
    });
    expect(data.form).toEqual({ available: false });
    expect(data.settings.contactEmail).toBe("support@vitalos.co.uk");
    expect(data.page?.key).toBe("contact");
  });
});
