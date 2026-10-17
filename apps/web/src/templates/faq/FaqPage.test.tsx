import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FaqGroup } from "./load";
import { FaqPage } from "./FaqPage";

const groups: FaqGroup[] = [
  {
    id: "alpha",
    title: "Alpha",
    href: "/solutions/alpha",
    entries: [{ id: "alpha--q1", question: "Q1?", answer: "A1." }],
  },
  {
    id: "beta",
    title: "Beta",
    href: "/solutions/beta",
    entries: [{ id: "beta--q2", question: "Q2?", answer: "A2." }],
  },
] as FaqGroup[];

describe("FaqPage", () => {
  const markup = renderToStaticMarkup(<FaqPage groups={groups} />);

  it("lists every group title as an in-page link to its stable anchor in one navigation", () => {
    expect(markup).toContain('aria-label="Question groups"');
    expect(markup).toContain('href="#alpha"');
    expect(markup).toContain('href="#beta"');
  });

  it("keeps each group as a section with its own heading and solution link", () => {
    expect(markup).toContain('id="alpha"');
    expect(markup).toContain('id="beta"');
    expect(markup).toContain(`id="faq-0">Alpha</h2>`);
    expect(markup).toContain(`id="faq-1">Beta</h2>`);
    expect(markup).toContain('href="/solutions/beta"');
  });
});
