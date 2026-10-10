import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MobileNav } from "./MobileNav";
import { SiteHeader } from "./SiteHeader";
import type { SiteNavItem } from "./types";

afterEach(cleanup);

const items: SiteNavItem[] = [
  {
    key: "section",
    label: "Example section (fixture)",
    href: "https://example.invalid/section",
    menu: {
      columns: [
        {
          key: "col",
          heading: "Example column (fixture)",
          href: "https://example.invalid/column",
          links: [{ label: "Example child (fixture)", href: "https://example.invalid/child" }],
        },
        { key: "empty", heading: "Example empty (fixture)", links: [] },
      ],
    },
  },
  { key: "plain", label: "Example plain (fixture)", href: "https://example.invalid/plain" },
];
const cta = { label: "Example action (fixture)", href: "https://example.invalid/contact" };
const utility = [{ label: "Example utility (fixture)", href: "https://example.invalid/utility" }];

describe("MobileNav", () => {
  it("is built from native details: closed by default, content in the DOM, no JS needed", () => {
    const { container } = render(<MobileNav items={items} cta={cta} utility={utility} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(container.querySelector("summary")?.textContent).toContain("Menu");
    expect(
      screen.getByRole("link", { name: "Example plain (fixture)", hidden: true }),
    ).toBeTruthy();
  });

  it("toggles when the summary (the focusable control) is activated", () => {
    const { container } = render(<MobileNav items={items} />);
    const summary = container.querySelector("summary") as HTMLElement;
    summary.focus();
    expect(document.activeElement).toBe(summary);
    fireEvent.click(summary);
    expect((container.querySelector("details") as HTMLDetailsElement).open).toBe(true);
    fireEvent.click(summary);
    expect((container.querySelector("details") as HTMLDetailsElement).open).toBe(false);
  });

  it("lets the trigger label and landmark name be overridden", () => {
    render(
      <MobileNav
        items={items}
        menuLabel="Example menu (fixture)"
        aria-label="Example nav (fixture)"
      />,
    );
    expect(screen.getByText("Example menu (fixture)")).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Example nav (fixture)", hidden: true }),
    ).toBeTruthy();
  });

  it("makes every section a nested disclosure whose first link is the section index", () => {
    const { container } = render(<MobileNav items={items} />);
    const nested = container.querySelectorAll("nav details");
    expect(nested).toHaveLength(1);
    const firstLink = nested[0]?.querySelector("a");
    expect(firstLink?.getAttribute("href")).toBe("https://example.invalid/section");
    expect(
      screen.getByRole("link", { name: "Example child (fixture)", hidden: true }),
    ).toBeTruthy();
    expect(screen.queryByText("Example empty (fixture)")).toBeNull();
  });

  it("keeps the passed-in primary action reachable in the bar and in the panel", () => {
    render(<MobileNav items={items} cta={cta} />);
    const links = screen.getAllByRole("link", { name: "Example action (fixture)", hidden: true });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.getAttribute("href")).toBe(cta.href);
  });

  it("renders no action when none is passed (no hard-coded copy)", () => {
    const { container } = render(<MobileNav items={items} />);
    expect(container.textContent).not.toMatch(/Talk to/);
    expect(screen.queryAllByRole("link", { name: /action/i, hidden: true })).toHaveLength(0);
  });

  it("marks the active section with aria-current", () => {
    render(<MobileNav items={items} activeKey="plain" />);
    expect(
      screen
        .getByRole("link", { name: "Example plain (fixture)", hidden: true })
        .getAttribute("aria-current"),
    ).toBe("true");
  });

  it("tab order inside the open panel follows the document: action, sections, children, utility", () => {
    const { container } = render(<MobileNav items={items} cta={cta} utility={utility} />);
    const order = Array.from(container.querySelectorAll<HTMLElement>("summary, a[href]")).map(
      (el) => el.textContent?.trim(),
    );
    expect(order).toEqual([
      "Example action (fixture)",
      "Menu",
      "Example action (fixture)",
      "Example section (fixture)",
      "Example section (fixture)",
      "Example column (fixture)",
      "Example child (fixture)",
      "Example plain (fixture)",
      "Example utility (fixture)",
    ]);
  });
});

describe("SiteHeader", () => {
  it("renders the wordmark, primary links and a MegaMenu for items with a menu", () => {
    render(
      <SiteHeader
        items={items}
        cta={cta}
        utility={utility}
        activeSection="plain"
        wordmarkText="Example brand (fixture)"
      />,
    );
    expect(screen.getByText("Example brand (fixture)")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Example section (fixture) menu", hidden: true }),
    ).toBeTruthy();
    const desktop = screen.getAllByRole("navigation", { hidden: true })[0] as HTMLElement;
    expect(desktop.querySelector('a[aria-current="true"]')?.textContent).toBe(
      "Example plain (fixture)",
    );
  });

  it("works with no items, utility or action", () => {
    const { container } = render(<SiteHeader items={[]} />);
    expect(container.querySelector("header")).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});
