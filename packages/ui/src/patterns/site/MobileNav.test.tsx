import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    expect(nested[0]?.querySelector('a[href="https://example.invalid/child"]')).not.toBeNull();
    expect(screen.queryByText("Example empty (fixture)")).toBeNull();
  });

  it("on tablets lists the sections as index links with every group open beside them", () => {
    const { container } = render(<MobileNav items={items} />);
    const nav = container.querySelector("nav") as HTMLElement;
    // md and up: the section row is a plain link to the index (the disclosure is md:hidden)...
    const row = nav.querySelector('ul > li > a[href="https://example.invalid/section"]');
    expect(row?.className).toContain("md:flex");
    expect(nav.querySelector("ul > li > details")?.className).toContain("md:hidden");
    // ...and the right-hand column (hidden below md) holds the groups, open, with no disclosure.
    const column = Array.from(nav.querySelectorAll("div")).find((div) =>
      div.className.split(" ").includes("md:block"),
    ) as HTMLElement;
    expect(column.className).toContain("hidden");
    expect(column.querySelector("details")).toBeNull();
    expect(column.querySelector('a[href="https://example.invalid/child"]')).not.toBeNull();
  });

  it("keeps the passed-in primary action in the bar at every width, outside the sheet", () => {
    const { container } = render(<MobileNav items={items} cta={cta} />);
    const links = screen.getAllByRole("link", { name: "Example action (fixture)", hidden: true });
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe(cta.href);
    expect(container.querySelector("details")?.contains(links[0] as Node)).toBe(false);
    // No breakpoint hides it (it used to appear only from 448px).
    expect(links[0]?.closest("[class*='hidden']")).toBeNull();
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

  it("tab order follows the document: action, trigger, sections, children, tablet groups, utility", () => {
    const { container } = render(<MobileNav items={items} cta={cta} utility={utility} />);
    const order = Array.from(container.querySelectorAll<HTMLElement>("summary, a[href]")).map(
      (el) => el.textContent?.trim(),
    );
    // The tablet row link and the phone disclosure (and the phone and tablet copies of a group)
    // are never displayed at the same width, so a visitor meets each destination once.
    expect(order).toEqual([
      "Example action (fixture)",
      "Menu",
      "Example section (fixture)",
      "Example section (fixture)",
      "Example section (fixture)",
      "Example column (fixture)",
      "Example child (fixture)",
      "Example plain (fixture)",
      "Example column (fixture)",
      "Example child (fixture)",
      "Example utility (fixture)",
    ]);
  });
});

describe("MobileNav sheet (JavaScript enhancement)", () => {
  /** jsdom lays nothing out; the trap only considers rendered elements, so give each a box. */
  function withBoxes() {
    return vi
      .spyOn(Element.prototype, "getClientRects")
      .mockReturnValue([{ width: 1, height: 1 }] as unknown as DOMRectList);
  }

  function renderInPage() {
    return render(
      <>
        <a href="https://example.invalid/skip">Example skip link (fixture)</a>
        <header>
          <MobileNav items={[items[1] as SiteNavItem]} utility={utility} />
        </header>
        <main>
          <a href="https://example.invalid/page">Example page link (fixture)</a>
        </main>
      </>,
    );
  }

  it("makes the rest of the page inert while open and restores it on close", () => {
    const boxes = withBoxes();
    const { container } = renderInPage();
    const summary = container.querySelector("summary") as HTMLElement;
    const main = container.querySelector("main") as HTMLElement;
    fireEvent.click(summary);
    expect((container.querySelector("details") as HTMLDetailsElement).open).toBe(true);
    expect(main.inert).toBe(true);
    expect(screen.getByText("Example skip link (fixture)").inert).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
    fireEvent.click(summary);
    expect(main.inert).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
    boxes.mockRestore();
  });

  it("traps Tab inside the trigger and the sheet, both ways", () => {
    const boxes = withBoxes();
    const { container } = renderInPage();
    const summary = container.querySelector("summary") as HTMLElement;
    fireEvent.click(summary);
    const last = screen.getByRole("link", { name: "Example utility (fixture)" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(summary);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    boxes.mockRestore();
  });

  it("keeps the bar's primary action inside the trap (it stays usable, never skipped)", () => {
    const boxes = withBoxes();
    const { container } = render(
      <>
        <header>
          <MobileNav items={[items[1] as SiteNavItem]} cta={cta} />
        </header>
        <main />
      </>,
    );
    fireEvent.click(container.querySelector("summary") as HTMLElement);
    const action = screen.getByRole("link", { name: "Example action (fixture)" });
    screen.getByRole("link", { name: "Example plain (fixture)" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(action);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Example plain (fixture)" }),
    );
    boxes.mockRestore();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    const boxes = withBoxes();
    const { container } = renderInPage();
    const summary = container.querySelector("summary") as HTMLElement;
    fireEvent.click(summary);
    screen.getByRole("link", { name: "Example plain (fixture)" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect((container.querySelector("details") as HTMLDetailsElement).open).toBe(false);
    expect(document.activeElement).toBe(summary);
    expect((container.querySelector("main") as HTMLElement).inert).toBe(false);
    boxes.mockRestore();
  });

  it("does nothing modal while closed (Escape and Tab are left alone)", () => {
    const { container } = renderInPage();
    const page = screen.getByRole("link", { name: "Example page link (fixture)" });
    page.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(page);
    expect((container.querySelector("main") as HTMLElement).inert).toBeFalsy();
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
