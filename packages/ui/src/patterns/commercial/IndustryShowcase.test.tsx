import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuroraBackdrop } from "../media/AuroraBackdrop";
import { IndustryShowcase, type IndustryShowcaseItem } from "./IndustryShowcase";

afterEach(cleanup);

const items: IndustryShowcaseItem[] = [
  {
    title: "Example industry one (fixture)",
    href: "https://example.invalid/one",
    summary: "Example summary one (fixture).",
    icon: "shield",
  },
  {
    title: "Example industry two (fixture)",
    href: "https://example.invalid/two",
    summary: "Example summary two (fixture).",
  },
];

describe("IndustryShowcase", () => {
  it("renders every industry as a link with its heading and summary", () => {
    render(<IndustryShowcase items={items} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(
      items.map((item) => item.title),
    );
    const link = screen.getByRole("link", { name: /Example industry two \(fixture\)/ });
    expect(link.getAttribute("href")).toBe("https://example.invalid/two");
    expect(link.textContent).toContain("Example summary two (fixture).");
  });

  it("opens the first panel, then the pointed or focused one", () => {
    const { container } = render(<IndustryShowcase items={items} />);
    const open = () =>
      [...container.querySelectorAll("a[data-active]")].map((a) => a.getAttribute("href"));
    expect(open()).toEqual(["https://example.invalid/one"]);
    fireEvent.pointerEnter(screen.getByRole("link", { name: /two/ }));
    expect(open()).toEqual(["https://example.invalid/two"]);
    fireEvent.focus(screen.getByRole("link", { name: /one/ }));
    expect(open()).toEqual(["https://example.invalid/one"]);
  });

  it("renders nothing without industries", () => {
    const { container } = render(<IndustryShowcase items={[]} />);
    expect(container.textContent).toBe("");
  });
});

describe("AuroraBackdrop", () => {
  it("is decorative and carries the looping drift classes the pause switch holds", () => {
    const { container } = render(<AuroraBackdrop />);
    const root = container.firstElementChild;
    expect(root?.getAttribute("aria-hidden")).toBe("true");
    for (const name of ["hv-aurora-a", "hv-aurora-b", "hv-aurora-c"]) {
      expect(container.querySelector(`.${name}`)).not.toBeNull();
    }
    expect(container.textContent).toBe("");
  });
});
