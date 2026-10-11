import { EmptyContentSource, closedGates } from "@vitalos/cms";
import type { ContactPageView, LegalPageView, SiteChromeView } from "@vitalos/cms";
import { describe, expect, it } from "vitest";
import { resolveContactPage } from "./contact-view";

const privacy: LegalPageView = {
  id: "legal-privacy-fixture",
  slug: "privacy",
  title: "Privacy notice (fixture)",
  version: "fixture-1",
  effectiveDate: "2026-01-01",
  body: [],
  seo: {},
};

const contactPage: ContactPageView = {
  key: "contact",
  heading: "Example heading (fixture)",
  seo: {},
  routes: [],
};

interface FakeOptions {
  privacy?: LegalPageView;
  page?: ContactPageView;
  email?: string;
}

class FakeSource extends EmptyContentSource {
  constructor(private readonly options: FakeOptions) {
    super();
  }
  override getSiteChrome(): Promise<SiteChromeView> {
    return Promise.resolve({
      settings: this.options.email ? { contactEmail: this.options.email } : {},
      gates: closedGates,
    });
  }
  override getRoutePage(): never {
    return Promise.resolve(this.options.page ?? null) as never;
  }
  override getDocument(): never {
    return Promise.resolve(this.options.privacy ?? null) as never;
  }
}

describe("resolveContactPage", () => {
  it("withholds the form when no privacy notice is published", async () => {
    const data = await resolveContactPage({
      source: new FakeSource({ email: "team@example.invalid" }),
      enquiryPersistence: true,
      configuredPrivacyNoticeVersion: "v1",
    });
    expect(data.form).toEqual({ available: false });
    expect(data.settings.contactEmail).toBe("team@example.invalid");
  });

  it("withholds the form when enquiries cannot be stored", async () => {
    const data = await resolveContactPage({
      source: new FakeSource({ privacy }),
      enquiryPersistence: false,
      configuredPrivacyNoticeVersion: "v1",
    });
    expect(data.form).toEqual({ available: false });
  });

  it("offers the form with the configured notice version", async () => {
    const data = await resolveContactPage({
      source: new FakeSource({ privacy, page: contactPage }),
      enquiryPersistence: true,
      configuredPrivacyNoticeVersion: "v7",
    });
    expect(data.form).toEqual({ available: true, privacyNoticeVersion: "v7" });
    expect(data.page?.heading).toBe("Example heading (fixture)");
  });

  it("falls back to the published notice version when none is configured", async () => {
    const data = await resolveContactPage({
      source: new FakeSource({ privacy }),
      enquiryPersistence: true,
      configuredPrivacyNoticeVersion: undefined,
    });
    expect(data.form).toEqual({ available: true, privacyNoticeVersion: "fixture-1" });
  });

  it("withholds the form when the notice version is not a valid label", async () => {
    const data = await resolveContactPage({
      source: new FakeSource({ privacy: { ...privacy, version: "has spaces" } }),
      enquiryPersistence: true,
      configuredPrivacyNoticeVersion: undefined,
    });
    expect(data.form).toEqual({ available: false });
  });

  it("shows the honest empty state with the empty content source", async () => {
    const data = await resolveContactPage({
      source: new EmptyContentSource(),
      enquiryPersistence: true,
      configuredPrivacyNoticeVersion: "v1",
    });
    expect(data).toMatchObject({ page: null, settings: {}, form: { available: false } });
  });
});
