import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Carousel } from "./Carousel";
import { CountUp, formatFigure, parseFigure } from "./CountUp";
import { Reveal } from "./Reveal";
import { RevealController } from "./RevealController";

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

describe("Reveal and RevealController", () => {
  it("renders content visible, with only a marker attribute, before any script runs", () => {
    render(<Reveal>Example content (fixture)</Reveal>);
    const element = screen.getByText("Example content (fixture)");
    expect(element.hasAttribute("data-reveal")).toBe(true);
    expect(element.hasAttribute("data-reveal-state")).toBe(false);
  });

  it("never hides anything under reduced motion", () => {
    stubMotion(true);
    render(
      <>
        <Reveal>Example content (fixture)</Reveal>
        <RevealController />
      </>,
    );
    expect(screen.getByText("Example content (fixture)").hasAttribute("data-reveal-state")).toBe(
      false,
    );
  });

  it("shows on-screen content at once and holds back only content below the fold", () => {
    stubMotion(false);
    render(
      <>
        <Reveal>On screen (fixture)</Reveal>
        <Reveal>Below the fold (fixture)</Reveal>
        <RevealController />
      </>,
    );
    const below = screen.getByText("Below the fold (fixture)");
    const onScreen = screen.getByText("On screen (fixture)");
    // jsdom lays nothing out (every rect is at 0), so everything starts on screen.
    expect(onScreen.dataset["revealState"]).toBe("done");
    expect(below.dataset["revealState"]).toBe("done");
  });

  it("reveals a pending element when it intersects", () => {
    stubMotion(false);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 5000 } as DOMRect);
    render(
      <>
        <Reveal>Below the fold (fixture)</Reveal>
        <RevealController />
      </>,
    );
    const element = screen.getByText("Below the fold (fixture)");
    expect(element.dataset["revealState"]).toBe("pending");
    const [io] = observed;
    act(() => io?.callback([{ isIntersecting: true, target: element }]));
    expect(element.dataset["revealState"]).toBe("shown");
    rect.mockRestore();
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
