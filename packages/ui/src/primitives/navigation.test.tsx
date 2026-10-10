import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnchorNav } from "./AnchorNav";
import { Breadcrumb } from "./Breadcrumb";

afterEach(cleanup);

describe("AnchorNav", () => {
  const items = [
    { id: "one", label: "Section one (fixture)" },
    { id: "two", label: "Section two (fixture)" },
  ];

  it("is a labelled nav of fragment links", () => {
    render(<AnchorNav items={items} />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(nav).toBeTruthy();
    expect(screen.getByRole("link", { name: "Section one (fixture)" }).getAttribute("href")).toBe(
      "#one",
    );
  });

  it("marks the current section and lets the label be overridden", () => {
    render(<AnchorNav items={items} currentId="two" aria-label="Page sections (fixture)" />);
    expect(screen.getByRole("navigation", { name: "Page sections (fixture)" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Section two (fixture)" }).getAttribute("aria-current"),
    ).toBe("location");
    expect(
      screen.getByRole("link", { name: "Section one (fixture)" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("renders nothing when there are no items", () => {
    const { container } = render(<AnchorNav items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("links are keyboard focusable", () => {
    render(<AnchorNav items={items} />);
    const first = screen.getAllByRole("link")[0];
    first?.focus();
    expect(document.activeElement).toBe(first);
  });
});

describe("Breadcrumb", () => {
  const items = [
    { label: "Home (fixture)", href: "/" },
    { label: "Section (fixture)", href: "/section" },
    { label: "Current page (fixture)" },
  ];

  it("is a labelled nav with an ordered list", () => {
    render(<Breadcrumb items={items} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("links every ancestor and marks the current page without a link", () => {
    render(<Breadcrumb items={items} />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Current page (fixture)" })).toBeNull();
    expect(screen.getByText("Current page (fixture)").getAttribute("aria-current")).toBe("page");
  });

  it("renders nothing when empty", () => {
    const { container } = render(<Breadcrumb items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
