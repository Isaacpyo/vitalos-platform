import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiDataEnquiryFormView } from "./AiDataEnquiryForm";
import type { AiDataEnquiryFormViewProps } from "./AiDataEnquiryForm";

const base: AiDataEnquiryFormViewProps = {
  state: { status: "idle" },
  formAction: () => undefined,
  privacyNoticeVersion: "fixture-1",
  idempotencyKey: "00000000-0000-4000-8000-000000000000",
};

const render = (over: Partial<AiDataEnquiryFormViewProps> = {}) =>
  renderToStaticMarkup(<AiDataEnquiryFormView {...base} {...over} />);

describe("AiDataEnquiryFormView", () => {
  it("is a plain form with labelled fields, the honeypot and the hidden context", () => {
    const html = render({ prefill: { utm: { source: "newsletter" } } });
    expect(html).toContain('id="ai-data-enquiry-form"');
    expect(html.toLowerCase()).toContain("novalidate");
    for (const name of [
      "name",
      "workEmail",
      "organisation",
      "role",
      "sector",
      "problem",
      "currentProcess",
      "desiredOutcome",
      "offer",
      "timeframe",
      "budget",
      "consent",
      "website",
    ]) {
      expect(html, name).toContain(`name="${name}"`);
    }
    expect(html).toContain('name="privacyNoticeVersion" value="fixture-1"');
    expect(html).toContain('name="utm_source" value="newsletter"');
    // The recorded source and intent are set on the server, never by a hidden field.
    expect(html).not.toContain('name="sourcePath"');
    expect(html).not.toContain('name="intent"');
    expect(html).toMatch(/<label[^>]*for="aid-problem"[^>]*>Business problem or workflow/);
  });

  it("offers the four offers plus 'Not sure yet', and pre-selects a known offer only", () => {
    const html = render({ prefill: { offer: "managed-ai-operations" } });
    expect(html).toMatch(/<option value="managed-ai-operations" selected="">/);
    expect(html).toContain('<option value="not-sure">Not sure yet</option>');
    expect(render({ prefill: { offer: "made-up" } })).toContain(
      '<option value="" selected="">No preference</option>',
    );
    expect(html).toContain("£1,000–£5,000");
    expect(html).not.toMatch(/£\d+ ?(per|\/) ?month/);
  });

  it("shows field errors in a summary and puts values back", () => {
    const html = render({
      state: {
        status: "invalid",
        message: "Check the highlighted fields and send your enquiry again.",
        fieldErrors: { problem: "Describe the business problem or workflow.", form: "Hidden." },
        values: { name: "Example Person", sector: "property", budget: "over-15k" },
      },
    });
    expect(html).toContain('href="#aid-problem"');
    expect(html).toContain('href="#ai-data-enquiry-form"');
    expect(html).toContain('value="Example Person"');
    expect(html).toMatch(/<option value="property" selected="">/);
    expect(html).toMatch(/<option value="over-15k" selected="">/);
  });

  it("explains a rejected or unavailable submission and offers email", () => {
    const html = render({
      state: {
        status: "unavailable",
        message: "We cannot receive enquiries online right now.",
        values: {},
      },
      contactEmail: "support@example.invalid",
    });
    expect(html).toContain("Enquiries are unavailable right now");
    expect(html).toContain("mailto:support@example.invalid");
  });
});
