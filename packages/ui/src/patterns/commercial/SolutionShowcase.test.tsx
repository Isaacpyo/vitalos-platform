import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SolutionShowcase, type SolutionShowcaseItem } from "./SolutionShowcase";

afterEach(cleanup);

const items: SolutionShowcaseItem[] = [
  {
    title: "Example solution one (fixture)",
    href: "https://example.invalid/one",
    summary: "Example summary one (fixture).",
    icon: "chip",
  },
  {
    title: "Example solution two (fixture)",
    href: "https://example.invalid/two",
    summary: "Example summary two (fixture).",
    icon: "workflow",
  },
  { title: "Example solution three (fixture)", href: "https://example.invalid/three" },
];

describe("SolutionShowcase", () => {
  it("lists every solution as a numbered link with its heading and its summary", () => {
    render(<SolutionShowcase items={items} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(items.map((item) => item.title));
    const link = screen.getByRole("link", { name: /Example solution two \(fixture\)/ });
    expect(link.getAttribute("href")).toBe("https://example.invalid/two");
    expect(link.textContent).toContain("02");
    expect(link.textContent).toContain("Example summary two (fixture).");
  });

  it("presents the pointed or focused solution in a decorative panel with nothing focusable", () => {
    const { container } = render(<SolutionShowcase items={items} />);
    const panel = container.querySelector("[data-solution-panel]");
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
    expect(panel?.querySelector("a, button, [tabindex]")).toBeNull();
    expect(panel?.textContent).toContain("01 / 03");
    expect(panel?.textContent).toContain("Example summary one (fixture).");
    fireEvent.pointerEnter(screen.getByRole("link", { name: /two/ }));
    expect(panel?.textContent).toContain("02 / 03");
    expect(panel?.textContent).toContain("Example solution two (fixture)");
    fireEvent.focus(screen.getByRole("link", { name: /three/ }));
    expect(panel?.textContent).toContain("03 / 03");
    expect(
      [...container.querySelectorAll("a[data-active]")].map((a) => a.getAttribute("href")),
    ).toEqual(["https://example.invalid/three"]);
  });

  it("shows each solution's line diagram in the panel, never a raster image", () => {
    const withDiagrams = [
      { ...items[0]!, diagram: "ai-journey" as const },
      { ...items[1]!, diagram: "process" as const },
      items[2]!,
    ];
    const { container } = render(<SolutionShowcase items={withDiagrams} />);
    expect(container.querySelector("img")).toBeNull();
    const panel = container.querySelector("[data-solution-panel]");
    const diagrams = panel?.querySelectorAll("[data-diagram]") ?? [];
    expect([...diagrams].map((d) => d.getAttribute("data-diagram"))).toEqual([
      "ai-journey",
      "process",
    ]);
    // The solution without a diagram keeps its place in the panel (its icon, if any).
    expect(panel?.querySelectorAll(".aspect-square > *")).toHaveLength(3);
  });

  it("renders nothing without solutions", () => {
    const { container } = render(<SolutionShowcase items={[]} />);
    expect(container.textContent).toBe("");
  });
});
