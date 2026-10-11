import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EnquiryFormState } from "../../features/enquiries/form-state";
import { EnquiryFormView } from "./EnquiryForm";
import type { EnquiryFormViewProps } from "./EnquiryForm";
import { buildIntentOptions } from "./labels";

const base: EnquiryFormViewProps = {
  state: { status: "idle" },
  formAction: () => undefined,
  sourcePath: "/contact",
  privacyNoticeVersion: "fixture-1",
  idempotencyKey: "00000000-0000-4000-8000-000000000000",
  intentOptions: buildIntentOptions(),
};

const render = (over: Partial<EnquiryFormViewProps> = {}) =>
  renderToStaticMarkup(<EnquiryFormView {...base} {...over} />);

const stateOf = (state: EnquiryFormState) => render({ state });

describe("EnquiryFormView markup", () => {
  it("is a plain form with persistent labels, correct types and autocomplete", () => {
    const html = render();
    expect(html).toContain("<form");
    expect(html.toLowerCase()).toContain("novalidate");
    expect(html).toMatch(/<label[^>]*for="enquiry-name"[^>]*>Name/);
    expect(html).toMatch(/<input[^>]*type="email"[^>]*name="workEmail"/);
    for (const autocomplete of ["name", "email", "organization", "organization-title"]) {
      expect(html.toLowerCase()).toContain(`autocomplete="${autocomplete}"`);
    }
  });

  it("carries the hidden context fields and no budget range", () => {
    const html = render({
      prefill: { offerSlug: "example-offer", utm: { source: "newsletter" } },
    });
    expect(html).toContain('name="sourcePath" value="/contact"');
    expect(html).toContain('name="privacyNoticeVersion" value="fixture-1"');
    expect(html).toContain('name="idempotencyKey" value="00000000-0000-4000-8000-000000000000"');
    expect(html).toContain('name="offerSlug" value="example-offer"');
    expect(html).toContain('name="utm_source" value="newsletter"');
    expect(html).not.toContain("budgetRange");
  });

  it("preselects the intent from the prefill", () => {
    const html = render({ prefill: { intent: "ai" } });
    expect(html).toMatch(/<option value="ai" selected/);
  });

  it("renders a hidden, unfocusable honeypot", () => {
    const html = render();
    expect(html).toMatch(/<div aria-hidden="true"[^>]*>/);
    expect(html).toContain("Leave this field empty");
    expect(html).toMatch(/<input[^>]*tabindex="-1"[^>]*autoComplete="off"[^>]*name="website"/i);
  });

  it("links the consent label to the privacy notice and never pre-ticks it", () => {
    const html = render();
    expect(html).toContain('href="/legal/privacy"');
    expect(html).not.toMatch(/name="consent"[^>]*checked/);
  });

  it("includes the Turnstile island only when a site key is given", () => {
    expect(render()).not.toContain("security check");
    expect(render({ turnstileSiteKey: "1x00000000000000000000AA" })).toContain("security check");
  });
});

describe("EnquiryFormView states", () => {
  it("shows the error summary, inline errors and keeps submitted values when invalid", () => {
    const html = stateOf({
      status: "invalid",
      message: "Check the highlighted fields and send your enquiry again.",
      fieldErrors: {
        workEmail: "Enter a work email address in the form name@company.com.",
        consent: "Confirm that you have read the privacy notice so that we can contact you.",
      },
      values: { name: "Example Person", workEmail: "not-an-email", intent: "engineering" },
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain('href="#enquiry-work-email"');
    expect(html).toContain('href="#enquiry-consent"');
    expect(html).toContain('value="Example Person"');
    expect(html).toContain('value="not-an-email"');
    expect(html).toMatch(/<option value="engineering" selected/);
    expect(html).toContain('aria-invalid="true"');
  });

  it("reports the stale-notice consent message", () => {
    const html = stateOf({
      status: "invalid",
      message: "Check the highlighted fields and send your enquiry again.",
      fieldErrors: {
        consent: "The privacy notice has changed. Reload the page and confirm again.",
      },
      values: {},
    });
    expect(html).toContain("The privacy notice has changed");
  });

  it("links errors on hidden fields to the form so they are not lost", () => {
    const html = stateOf({
      status: "invalid",
      message: "Check the highlighted fields.",
      fieldErrors: { sourcePath: "Source path must be a path on this site." },
      values: {},
    });
    expect(html).toContain('href="#enquiry-form"');
    expect(html).toContain("Source path must be a path on this site.");
  });

  it("shows the reference and the CMS success message when accepted, and the form is gone", () => {
    const html = render({
      state: { status: "accepted", reference: "VIT-0123456789AB" },
      successMessage: "Example success message (fixture).",
    });
    expect(html).toContain("VIT-0123456789AB");
    expect(html).toContain("Example success message (fixture).");
    expect(html).not.toContain("<form");
  });

  it("gives a neutral receipt with no response-time promise when there is no CMS message", () => {
    const html = stateOf({ status: "accepted", reference: "VIT-0123456789AB" });
    expect(html).toContain("Your enquiry has been received");
    const text = html.replace(/<[^>]*>/g, " ").replace("VIT-0123456789AB", "");
    expect(text).not.toMatch(/within|hours|days|shortly|soon|24|48/i);
  });

  it("shows retry guidance when rate limited and keeps the values", () => {
    const html = stateOf({
      status: "rate-limited",
      message:
        "Too many enquiries have been sent from your connection. Please try again in 5 minutes.",
      retryAfterSeconds: 300,
      values: { name: "Example Person" },
    });
    expect(html).toContain("try again in 5 minutes");
    expect(html).toContain('value="Example Person"');
  });

  it("shows an honest unavailable message with the contact email when there is one", () => {
    const html = render({
      state: {
        status: "unavailable",
        message: "We cannot receive enquiries online right now. Please contact us directly.",
        values: {},
      },
      contactEmail: "team@example.invalid",
    });
    expect(html).toContain("We cannot receive enquiries online right now");
    expect(html).toContain('href="mailto:team@example.invalid"');
  });

  it("shows a rejected message and keeps the form", () => {
    const html = stateOf({
      status: "rejected",
      message: "We could not verify this request. Please try again.",
      values: { name: "Example Person" },
    });
    expect(html).toContain("We could not verify this request");
    expect(html).toContain("<form");
  });
});
