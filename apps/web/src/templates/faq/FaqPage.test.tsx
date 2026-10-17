import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FaqGroup } from "./load";
import { FaqPage } from "./FaqPage";

const groups: FaqGroup[] = [
  { title: "Alpha", href: "/solutions/alpha", entries: [{ question: "Q1?", answer: "A1." }] },
  { title: "Beta", href: "/solutions/beta", entries: [{ question: "Q2?", answer: "A2." }] },
] as FaqGroup[];

describe("FaqPage", () => {
  const markup = renderToStaticMarkup(<FaqPage groups={groups} />);

  it("lists every group title as an in-page link in one navigation", () => {
    expect(markup).toContain('aria-label="Question groups"');
    expect(markup).toContain('href="#faq-0"');
    expect(markup).toContain('href="#faq-1"');
  });

  it("keeps each group as a section with its own heading and solution link", () => {
    expect(markup).toContain('id="faq-0"');
    expect(markup).toContain('id="faq-1"');
    expect(markup).toContain(`id="faq-0-title">Alpha</h2>`);
    expect(markup).toContain(`id="faq-1-title">Beta</h2>`);
    expect(markup).toContain('href="/solutions/beta"');
  });
});
