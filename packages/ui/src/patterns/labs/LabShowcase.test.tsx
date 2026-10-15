import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TerminalCTA } from "../site/TerminalCTA";
import { LabShowcase, type LabShowcaseItem } from "./LabShowcase";

afterEach(cleanup);

const items: LabShowcaseItem[] = [
  {
    title: "Example lab one (fixture)",
    href: "https://example.invalid/labs/one",
    eyebrow: "Example type (fixture)",
    summary: "Example summary one (fixture).",
    maturity: "concept",
    maturityLabel: "Concept",
  },
  {
    title: "Example lab two (fixture)",
    href: "https://example.invalid/labs/two",
    maturity: "prototype",
    maturityLabel: "Prototype",
  },
];

describe("LabShowcase", () => {
  it("shows every asset as a link with its type, title and maturity in words", () => {
    render(<LabShowcase items={items} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Example lab one (fixture)",
      "Example lab two (fixture)",
    ]);
    const first = screen.getByRole("link", { name: /Example lab one/ });
    expect(first.getAttribute("href")).toBe("https://example.invalid/labs/one");
    expect(first.textContent).toContain("Example type (fixture)");
    expect(first.textContent).toContain("Concept");
    expect(screen.getByRole("link", { name: /Example lab two/ }).textContent).toContain(
      "Prototype",
    );
  });

  it("closes with the index card and its lab types", () => {
    render(
      <LabShowcase
        items={items}
        more={{
          label: "Example index (fixture)",
          href: "/labs",
          types: ["Example type (fixture)"],
        }}
      />,
    );
    const index = screen.getByRole("link", { name: /Example index \(fixture\)/ });
    expect(index.getAttribute("href")).toBe("/labs");
    expect(index.textContent).toContain("Example type (fixture)");
  });

  it("renders nothing without assets", () => {
    const { container } = render(<LabShowcase items={[]} />);
    expect(container.textContent).toBe("");
  });
});

describe("TerminalCTA feature variant", () => {
  it("renders the heading, body and both actions on a dark card", () => {
    const { container } = render(
      <TerminalCTA
        variant="feature"
        heading="Example closing (fixture)"
        body="Example line (fixture)."
        primary={{ label: "Example primary (fixture)", href: "/contact" }}
        secondary={{ label: "Example secondary (fixture)", href: "/what-we-do" }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Example closing (fixture)" }),
    ).toBeTruthy();
    expect(screen.getByText("Example line (fixture).")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Example primary/ }).getAttribute("href")).toBe(
      "/contact",
    );
    expect(screen.getByRole("link", { name: /Example secondary/ }).getAttribute("href")).toBe(
      "/what-we-do",
    );
    expect(container.querySelector('[data-tone="dark"]')).not.toBeNull();
  });
});
