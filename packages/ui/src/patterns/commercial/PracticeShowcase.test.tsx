import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PracticeShowcase, type PracticeShowcaseItem } from "./PracticeShowcase";

afterEach(cleanup);

const image = (name: string) => ({
  src: `/example/${name}.webp`,
  srcSet: `/example/${name}-960.webp 960w, /example/${name}.webp 1672w`,
  width: 1672,
  height: 941,
});

const items: PracticeShowcaseItem[] = [
  {
    title: "Example practice one (fixture)",
    href: "https://example.invalid/one",
    summary: "Example summary one (fixture).",
    icon: "compass",
    image: image("one"),
  },
  {
    title: "Example practice two (fixture)",
    href: "https://example.invalid/two",
    summary: "Example summary two (fixture).",
    icon: "code",
    image: image("two"),
  },
  // No illustration: the stage falls back to the icon on a tint.
  {
    title: "Example practice three (fixture)",
    href: "https://example.invalid/three",
    icon: "chip",
  },
];

describe("PracticeShowcase", () => {
  it("lists every practice as a numbered link with its heading and summary", () => {
    render(<PracticeShowcase items={items} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(items.map((item) => item.title));
    const link = screen.getByRole("link", { name: /Example practice two \(fixture\)/ });
    expect(link.getAttribute("href")).toBe("https://example.invalid/two");
    expect(link.textContent).toContain("02");
    expect(link.textContent).toContain("Example summary two (fixture).");
  });

  it("starts with the first practice active and makes the pointed or focused one active", () => {
    const { container } = render(<PracticeShowcase items={items} />);
    const active = () =>
      [...container.querySelectorAll("a[data-active]")].map((a) => a.getAttribute("href"));
    expect(active()).toEqual(["https://example.invalid/one"]);
    fireEvent.pointerEnter(screen.getByRole("link", { name: /two/ }));
    expect(active()).toEqual(["https://example.invalid/two"]);
    fireEvent.focus(screen.getByRole("link", { name: /three/ }));
    expect(active()).toEqual(["https://example.invalid/three"]);
  });

  it("keeps the stage decorative, with an illustration per practice that has one", () => {
    const { container } = render(<PracticeShowcase items={items} />);
    const stage = container.querySelector("[data-practice-stage]");
    expect(stage?.getAttribute("aria-hidden")).toBe("true");
    expect(stage).not.toBeNull();
    const stageImages = stage?.querySelectorAll("img") ?? [];
    expect(stageImages).toHaveLength(2);
    for (const img of stageImages) expect(img.getAttribute("alt")).toBe("");
    expect(stageImages[0]?.getAttribute("srcset")).toContain("960w");
    expect(stage?.textContent).toContain("01 / 03");
    // The compact layout's own illustrations are decorative too, inside the named links.
    const inline = container.querySelectorAll("ol img");
    expect(inline).toHaveLength(2);
    for (const img of inline) expect(img.getAttribute("alt")).toBe("");
  });

  it("renders nothing without practices", () => {
    const { container } = render(<PracticeShowcase items={[]} />);
    expect(container.textContent).toBe("");
  });
});
