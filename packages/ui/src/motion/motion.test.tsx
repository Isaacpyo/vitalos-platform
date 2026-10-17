import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Carousel } from "./Carousel";
import { CountUp, formatFigure, parseFigure } from "./CountUp";
import { Reveal, RevealItem } from "./Reveal";
import { SettleText } from "./SettleText";
import { Parallax } from "./Parallax";

afterEach(cleanup);

type Callback = (entries: { isIntersecting: boolean; target: Element }[]) => void;
let observed: { callback: Callback; targets: Element[] }[] = [];

function stubMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  window.matchMedia = globalThis.matchMedia;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      targets: Element[] = [];
      constructor(callback: Callback) {
        observed.push({ callback, targets: this.targets });
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

beforeEach(() => {
  observed = [];
  // jsdom reports a 0px document, which reads as "scrolled to the bottom"; give it a long page.
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 100_000,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseFigure / formatFigure", () => {
  it("splits a single-number figure and formats it back in the same shape", () => {
    const figure = parseFigure("£1,250.5k");
    expect(figure).toEqual({
      prefix: "£",
      number: 1250.5,
      decimals: 1,
      grouped: true,
      suffix: "k",
    });
    expect(formatFigure(figure!, 0)).toBe("£0.0k");
    expect(formatFigure(figure!, 1250.5)).toBe("£1,250.5k");
    expect(parseFigure("38%")).toMatchObject({ number: 38, suffix: "%" });
  });

  it("refuses figures that are not one plain number", () => {
    expect(parseFigure("24/7")).toBeNull();
    expect(parseFigure("2019 to 2024")).toBeNull();
    expect(parseFigure("Example")).toBeNull();
  });
});

describe("CountUp", () => {
  it("renders the final figure on the server path and keeps a copy for assistive technology", () => {
    stubMotion(false);
    render(<CountUp value="38%" />);
    const copies = screen.getAllByText("38%");
    expect(copies).toHaveLength(2);
    expect(copies[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(copies[1]?.className).toContain("sr-only");
  });

  it("does not observe or animate under reduced motion", () => {
    stubMotion(true);
    render(<CountUp value="38%" />);
    expect(observed).toHaveLength(0);
    expect(screen.getAllByText("38%")).toHaveLength(2);
  });
});

describe("Reveal (Motion)", () => {
  it("renders content visible with no motion styles before any script runs", () => {
    render(<Reveal>Example content (fixture)</Reveal>);
    const element = screen.getByText("Example content (fixture)");
    expect(element.dataset["revealState"]).toBe("static");
    // Nothing hidden, translated or clipped in the first render (the server HTML).
    expect(element.getAttribute("style") ?? "").not.toMatch(/opacity|clip-path|translate/);
  });

  it("never hides anything under reduced motion, even below the fold", () => {
    stubMotion(true);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 5000 } as DOMRect);
    render(<Reveal>Below the fold (fixture)</Reveal>);
    expect(screen.getByText("Below the fold (fixture)").dataset["revealState"]).toBe("static");
    rect.mockRestore();
  });

  it("leaves content that starts on screen alone", () => {
    stubMotion(false);
    // jsdom lays nothing out (every rect is at 0), so everything starts on screen.
    render(<Reveal>On screen (fixture)</Reveal>);
    expect(screen.getByText("On screen (fixture)").dataset["revealState"]).toBe("static");
  });

  it("holds back content below the fold and shows it once it scrolls into view", async () => {
    stubMotion(false);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 5000 } as DOMRect);
    render(<Reveal>Below the fold (fixture)</Reveal>);
    const element = screen.getByText("Below the fold (fixture)");
    expect(element.dataset["revealState"]).toBe("hidden");
    // Hidden by a lowered, clipped box; never by opacity.
    expect(element.style.opacity).toBe("");
    // Scrolled into view.
    rect.mockReturnValue({ top: 200 } as DOMRect);
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(element.dataset["revealState"]).toBe("shown");
    rect.mockRestore();
  });

  it("shows content a jump carried past the viewport (End key, anchor link)", async () => {
    stubMotion(false);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 5000 } as DOMRect);
    render(<Reveal>Passed over (fixture)</Reveal>);
    const element = screen.getByText("Passed over (fixture)");
    expect(element.dataset["revealState"]).toBe("hidden");
    // Now entirely above the viewport: never left hidden behind the visitor.
    rect.mockReturnValue({ top: -3000 } as DOMRect);
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(element.dataset["revealState"]).toBe("shown");
    rect.mockRestore();
  });

  async function nextFrame() {
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
  }

  function heldBack(text: string) {
    stubMotion(false);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 5000 } as DOMRect);
    render(
      <Reveal>
        <a href="/x">{text}</a>
      </Reveal>,
    );
    const element = screen.getByText(text).parentElement as HTMLElement;
    expect(element.dataset["revealState"]).toBe("hidden");
    return { element, rect };
  }

  it("shows a held-back element as soon as focus moves into it", () => {
    const { element, rect } = heldBack("Focus target (fixture)");
    act(() => screen.getByText("Focus target (fixture)").focus());
    expect(element.dataset["revealState"]).toBe("shown");
    rect.mockRestore();
  });

  it("shows whatever is left once the page is scrolled to the bottom", async () => {
    const { element, rect } = heldBack("Short last band (fixture)");
    // Still below the 92% line, but there is no more page to scroll.
    rect.mockReturnValue({ top: window.innerHeight * 0.95 } as DOMRect);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: window.innerHeight,
    });
    window.dispatchEvent(new Event("scroll"));
    await nextFrame();
    expect(element.dataset["revealState"]).toBe("shown");
    rect.mockRestore();
  });

  it("shows everything held back before printing", () => {
    const { element, rect } = heldBack("Printed band (fixture)");
    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    expect(element.dataset["revealState"]).toBe("shown");
    rect.mockRestore();
  });

  it("releases held-back content when reduced motion is switched on mid-visit", () => {
    const listeners: (() => void)[] = [];
    let reduce = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        get matches() {
          return reduce && query.includes("reduce");
        },
        media: query,
        addEventListener: (_: string, listener: () => void) => listeners.push(listener),
        removeEventListener: vi.fn(),
      })),
    );
    window.matchMedia = globalThis.matchMedia;
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 5000 } as DOMRect);
    render(<Reveal>Switched (fixture)</Reveal>);
    const element = screen.getByText("Switched (fixture)");
    expect(element.dataset["revealState"]).toBe("hidden");
    reduce = true;
    act(() => {
      for (const listener of listeners) listener();
    });
    expect(element.dataset["revealState"]).toBe("shown");
    rect.mockRestore();
  });

  it("a stagger group never moves itself; its items follow it and are static on their own", () => {
    render(
      <>
        <Reveal stagger as="ul">
          <RevealItem as="li">Grouped item (fixture)</RevealItem>
        </Reveal>
        <RevealItem>Lone item (fixture)</RevealItem>
      </>,
    );
    const group = screen.getByRole("list");
    expect(group.dataset["reveal"]).toBe("group");
    expect(screen.getByText("Grouped item (fixture)").tagName).toBe("LI");
    expect(screen.getByText("Lone item (fixture)").getAttribute("style") ?? "").not.toMatch(
      /opacity|clip-path/,
    );
  });
});

describe("Reveal never clips (finding A9)", () => {
  it("holds a below-the-fold element lowered but whole, and shows it with no clip", async () => {
    stubMotion(false);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 5000, bottom: 5100 } as DOMRect);
    render(<Reveal>Problems we solve (fixture)</Reveal>);
    const element = await screen.findByText("Problems we solve (fixture)");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(element.getAttribute("style") ?? "").not.toMatch(/clip-path|opacity/);
    rect.mockRestore();
  });
});

describe("Parallax", () => {
  async function scrollTo(y: number) {
    await act(async () => {
      Object.defineProperty(window, "scrollY", { configurable: true, value: y });
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
  }

  it("follows page scroll by a few pixels, clamped to its travel", async () => {
    stubMotion(false);
    const { container } = render(
      <Parallax travel={-24} distance={600}>
        <span />
      </Parallax>,
    );
    const layer = container.firstElementChild as HTMLElement;
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    await scrollTo(300);
    expect(layer.style.transform).toContain("-12px");
    await scrollTo(5000);
    expect(layer.style.transform).toContain("-24px");
    await scrollTo(0);
  });

  it("never moves under reduced motion", async () => {
    stubMotion(true);
    const { container } = render(
      <Parallax travel={-24}>
        <span />
      </Parallax>,
    );
    await scrollTo(400);
    const transform = (container.firstElementChild as HTMLElement).style.transform;
    expect(transform === "" || transform === "none").toBe(true);
    await scrollTo(0);
  });
});

describe("SettleText", () => {
  it("keeps the exact text (accessible name), colours the accent part and stays within 400ms", () => {
    const { container } = render(
      <h1>
        <SettleText
          parts={[
            { text: "Example words of a fixture headline and " },
            { text: "its accent.", accent: true },
          ]}
        />
      </h1>,
    );
    const heading = container.querySelector("h1") as HTMLElement;
    expect(heading.textContent).toBe("Example words of a fixture headline and its accent.");
    const words = Array.from(heading.querySelectorAll<HTMLElement>("span span"));
    expect(words).toHaveLength(9);
    expect(words.at(-1)?.className).toContain("text-tone-link");
    const delays = words.map((word) => parseFloat(word.style.animationDelay));
    // The last word starts early enough for its 240ms settle to end by 400ms.
    expect(Math.max(...delays) + 240).toBeLessThanOrEqual(400);
    // Never faded: the settle is a translate only, behind motion-safe.
    for (const word of words) {
      expect(word.className).toContain("motion-safe:animate-[hero-word");
      expect(word.style.opacity).toBe("");
    }
  });
});

describe("Carousel", () => {
  it("is a named region with a list and two labelled paging buttons tied to it", () => {
    stubMotion(false);
    vi.stubGlobal("ResizeObserver", undefined);
    render(
      <Carousel label="Example items (fixture)" previousLabel="Previous" nextLabel="Next">
        <li>
          <a href="/a">Item A</a>
        </li>
        <li>
          <a href="/b">Item B</a>
        </li>
      </Carousel>,
    );
    const region = screen.getByRole("region", { name: "Example items (fixture)" });
    const list = region.querySelector("ul");
    expect(list?.children).toHaveLength(2);
    for (const name of ["Previous", "Next"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-controls")).toBe(list?.id);
      // jsdom has no overflow, so there is nowhere to page to.
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe("Carousel keyboard paging", () => {
  function renderRow() {
    stubMotion(false);
    vi.stubGlobal("ResizeObserver", undefined);
    render(
      <Carousel label="Example items (fixture)" previousLabel="Previous" nextLabel="Next">
        {["A", "B", "C"].map((name) => (
          <li key={name}>
            <a href={`/${name}`}>Item {name}</a>
          </li>
        ))}
      </Carousel>,
    );
    const list = screen.getByRole("list");
    // Lay the row out: three 300px items in a 500px scroller.
    Object.defineProperty(list, "scrollWidth", { configurable: true, value: 900 });
    Object.defineProperty(list, "clientWidth", { configurable: true, value: 500 });
    Array.from(list.children).forEach((item, index) =>
      Object.defineProperty(item, "offsetLeft", { configurable: true, value: index * 300 }),
    );
    const scrollTo = vi.fn();
    list.scrollTo = scrollTo;
    return { list, scrollTo };
  }

  it("moves focus and the row with Arrow keys, Home and End", () => {
    const { scrollTo } = renderRow();
    const first = screen.getByRole("link", { name: "Item A" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Item B" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: "smooth" });
    fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Item C" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: "smooth" });
    fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    expect(document.activeElement).toBe(first);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "smooth" });
  });

  it("stops at either end and pages instantly under reduced motion", () => {
    const { scrollTo } = renderRow();
    stubMotion(true);
    const first = screen.getByRole("link", { name: "Item A" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(first);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "auto" });
  });

  it("leaves the keys alone when the list is stacked (nothing to scroll)", () => {
    const { list, scrollTo } = renderRow();
    Object.defineProperty(list, "scrollWidth", { configurable: true, value: 500 });
    const first = screen.getByRole("link", { name: "Item A" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(first);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
