import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageHero } from "../layout/PageHero";
import { FeatureGrid } from "./FeatureGrid";

afterEach(cleanup);

describe("FeatureGrid", () => {
  it("renders each item as a list item with its title and line", () => {
    render(
      <FeatureGrid
        items={[
          { title: "Example one (fixture)", text: "Line one (fixture).", icon: "compass" },
          { title: "Example two (fixture)", text: "Line two (fixture)." },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Example one (fixture)",
      "Example two (fixture)",
    ]);
    expect(screen.getByText("Line two (fixture).")).toBeTruthy();
  });

  it("makes a linked card one link named by its title and line", () => {
    render(<FeatureGrid items={[{ title: "Linked (fixture)", text: "Go.", href: "/offers/x" }]} />);
    const link = screen.getByRole("link", { name: /Linked \(fixture\)/ });
    expect(link.getAttribute("href")).toBe("/offers/x");
  });

  it("renders statements without titles as rows, and nothing for an empty list", () => {
    const { container, rerender } = render(
      <FeatureGrid variant="rows" items={[{ text: "A statement (fixture)." }, { text: " " }]} />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByRole("heading")).toBeNull();
    rerender(<FeatureGrid items={[{ text: "" }]} />);
    expect(container.textContent).toBe("");
  });
});

describe("PageHero dark", () => {
  it("renders one h1, the lead, the media and a decorative backdrop", () => {
    const { container } = render(
      <PageHero
        tone="dark"
        title="Example page (fixture)"
        eyebrow="Example eyebrow (fixture)"
        lead="Example lead (fixture)."
        backdrop={{ src: "/images/hero/x.webp", width: 1672, height: 941 }}
        media={<p>Example media (fixture)</p>}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Example lead (fixture).")).toBeTruthy();
    expect(screen.getByText("Example media (fixture)")).toBeTruthy();
    expect(container.querySelector('[data-tone="dark"]')).not.toBeNull();
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
