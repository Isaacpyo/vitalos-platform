import type { ContactPageView, ContentSource, SiteSettingsView } from "@vitalos/cms";

/** Characters a privacy notice version may contain (mirrors the enquiry contract). */
const versionLabel = /^[A-Za-z0-9._-]{1,40}$/;

export type ContactFormAvailability =
  | {
      available: true;
      /** The version the visitor is shown and the server will accept. */
      privacyNoticeVersion: string;
    }
  | { available: false };

export interface ContactPageData {
  page: ContactPageView | null;
  settings: SiteSettingsView;
  form: ContactFormAvailability;
}

export interface ContactPageInputs {
  source: ContentSource;
  /** `features.enquiryPersistence`: a backend that can store enquiries is active. */
  enquiryPersistence: boolean;
  /** `getEnv().enquiry.privacyNoticeVersion`, when configured. */
  configuredPrivacyNoticeVersion: string | undefined;
}

/**
 * Decides what the contact page can honestly show.
 *
 * The form is offered only when (1) enquiries can be stored and (2) a privacy notice is
 * published, so personal data is never collected without a notice (stage-1 plan, workstream H).
 * The recorded notice version is the configured one when set (the server requires exactly that
 * value) and otherwise the published notice's own version; with neither, the form is withheld
 * because consent could not be recorded against a known notice.
 */
export async function resolveContactPage(inputs: ContactPageInputs): Promise<ContactPageData> {
  const { source } = inputs;
  const [page, chrome, privacy] = await Promise.all([
    source.getRoutePage("contact"),
    source.getSiteChrome(),
    source.getDocument("legalPage", "privacy"),
  ]);

  const version = inputs.configuredPrivacyNoticeVersion ?? privacy?.version;
  const form: ContactFormAvailability =
    inputs.enquiryPersistence && privacy !== null && version && versionLabel.test(version)
      ? { available: true, privacyNoticeVersion: version }
      : { available: false };

  return { page, settings: chrome.settings, form };
}
