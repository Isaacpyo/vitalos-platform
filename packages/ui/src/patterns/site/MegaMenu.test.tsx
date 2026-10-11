import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MegaMenu } from "./MegaMenu";
import type { MegaMenuColumn } from "./types";

const columns: MegaMenuColumn[] = [
  {
    key: "practices",
    heading: "Example practices (fixture)",
    href: "https://example.invalid/practices",
    links: [
      { label: "Example practice one (fixture)", href: "https://example.invalid/p1" },
      { label: "Example practice two (fixture)", href: "https://example.invalid/p2" },
    ],
  },
  {
    key: "offers",
    heading: "Example offers (fixture)",
    links: [{ label: "Example offer (fixture)", href: "https://example.invalid/o1" }],
  },
  { key: "empty", heading: "Example empty column (fixture)", links: [] },
];

function renderMenu(extra: Partial<Parameters<typeof MegaMenu>[0]> = {}) {
  return render(
    <ul>
      <MegaMenu
        id="menu"
        label="Example section (fixture)"
        href="https://example.invalid/section"
        columns={columns}
        {...extra}
      />
      <li>
        <a href="https://example.invalid/next">Next item (fixture)</a>
      </li>
    </ul>,
  );
}

const toggle = () => screen.getByRole("button", { name: "Example section (fixture) menu" });
const panel = () => document.getElementById("menu-panel") as HTMLElement;

function mockPointer(fine: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: fine && query === "(pointer: fine)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("MegaMenu structure", () => {
  it("keeps the parent label a real link to the section index, separate from the button", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: "Example section (fixture)" });
    expect(link.getAttribute("href")).toBe("https://example.invalid/section");
    expect(link.tagName).toBe("A");
    expect(toggle().tagName).toBe("BUTTON");
    expect(link.contains(toggle())).toBe(false);
  });

  it("starts closed with aria-expanded and aria-controls pointing at the panel", () => {
    renderMenu();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().getAttribute("aria-controls")).toBe("menu-panel");
    expect(panel().hidden).toBe(true);
  });

  it("omits columns without links and links the column heading when it has an index", () => {
    renderMenu();
    expect(screen.queryByText("Example empty column (fixture)")).toBeNull();
    const heading = screen.getByRole("link", { name: "Example practices (fixture)", hidden: true });
    expect(heading.getAttribute("href")).toBe("https://example.invalid/practices");
  });

  it("marks the active section with aria-current", () => {
    renderMenu({ active: true });
    expect(
      screen.getByRole("link", { name: "Example section (fixture)" }).getAttribute("aria-current"),
    ).toBe("true");
  });

  it("degrades to a plain link when no column has links", () => {
    renderMenu({ columns: [{ key: "x", heading: "Example (fixture)", links: [] }] });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "Example section (fixture)" })).toBeTruthy();
  });

  it("lets the toggle label be overridden", () => {
    renderMenu({ toggleLabel: "Show example section (fixture)" });
    expect(screen.getByRole("button", { name: "Show example section (fixture)" })).toBeTruthy();
  });
});

describe("MegaMenu keyboard", () => {
  it("opens and closes with the disclosure button", () => {
    renderMenu();
    toggle().focus();
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(panel().hidden).toBe(false);
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(panel().hidden).toBe(true);
  });

  it("closes on Escape and returns focus to the button when focus was in the panel", () => {
    renderMenu();
    fireEvent.click(toggle());
    const first = screen.getByRole("link", { name: "Example practice one (fixture)" });
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Escape" });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(toggle());
  });

  it("closes on Escape pressed on the button and keeps focus there", () => {
    renderMenu();
    toggle().focus();
    fireEvent.click(toggle());
    fireEvent.keyDown(toggle(), { key: "Escape" });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle());
  });

  it("Escape does nothing harmful when the menu is closed", () => {
    renderMenu();
    toggle().focus();
    fireEvent.keyDown(toggle(), { key: "Escape" });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("tab order is label, button, panel links in order, then the next item", () => {
    renderMenu();
    fireEvent.click(toggle());
    const tabbable = Array.from(
      document.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
    ).map((el) => el.textContent?.trim() || el.getAttribute("aria-label"));
    expect(tabbable).toEqual([
      "Example section (fixture)",
      "Example section (fixture) menu",
      "Example practices (fixture)",
      "Example practice one (fixture)",
      "Example practice two (fixture)",
      "Example offer (fixture)",
      "Next item (fixture)",
    ]);
  });

  it("closes when focus moves outside the item", () => {
    renderMenu();
    fireEvent.click(toggle());
    const link = screen.getByRole("link", { name: "Example offer (fixture)" });
    link.focus();
    const next = screen.getByRole("link", { name: "Next item (fixture)" });
    fireEvent.blur(link, { relatedTarget: next });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("stays open when focus moves within the item", () => {
    renderMenu();
    fireEvent.click(toggle());
    const one = screen.getByRole("link", { name: "Example practice one (fixture)" });
    const two = screen.getByRole("link", { name: "Example practice two (fixture)" });
    fireEvent.blur(one, { relatedTarget: two });
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on a pointer press outside", () => {
    renderMenu();
    fireEvent.click(toggle());
    fireEvent.pointerDown(document.body);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });
});

describe("MegaMenu hover intent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("opens after a dwell for a fine pointer and closes after leaving", () => {
    mockPointer(true);
    const { container } = renderMenu();
    const item = container.querySelector("li") as HTMLElement;
    fireEvent.pointerEnter(item, { pointerType: "mouse" });
    expect(panel().hidden).toBe(true);
    act(() => void vi.advanceTimersByTime(200));
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerLeave(item, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(400));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("does not open on a quick pass of the pointer", () => {
    mockPointer(true);
    const { container } = renderMenu();
    const item = container.querySelector("li") as HTMLElement;
    fireEvent.pointerEnter(item, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(40));
    fireEvent.pointerLeave(item, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(400));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("never opens on hover for a coarse pointer", () => {
    mockPointer(false);
    const { container } = renderMenu();
    const item = container.querySelector("li") as HTMLElement;
    fireEvent.pointerEnter(item, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(500));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("never opens on hover for touch, and the button still works", () => {
    mockPointer(true);
    const { container } = renderMenu();
    const item = container.querySelector("li") as HTMLElement;
    fireEvent.pointerEnter(item, { pointerType: "touch" });
    act(() => void vi.advanceTimersByTime(500));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });

  it("a click pins a hover-opened menu open instead of closing it", () => {
    mockPointer(true);
    const { container } = renderMenu();
    const item = container.querySelector("li") as HTMLElement;
    fireEvent.pointerEnter(item, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(200));
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerLeave(item, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(500));
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });

  it("Escape dismisses hover-opened content", () => {
    mockPointer(true);
    const { container } = renderMenu();
    const item = container.querySelector("li") as HTMLElement;
    fireEvent.pointerEnter(item, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(200));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });
});
