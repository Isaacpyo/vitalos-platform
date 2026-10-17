import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProcessCycle, type ProcessCycleStage } from "./ProcessCycle";

afterEach(cleanup);

const stages: ProcessCycleStage[] = [
  {
    title: "Example stage one (fixture)",
    summary: "Example summary one (fixture).",
    icon: "search",
  },
  {
    title: "Example stage two (fixture)",
    summary: "Example summary two (fixture).",
  },
  { title: "Example stage three (fixture)" },
];

describe("ProcessCycle", () => {
  it("lists the stages in order as buttons that select, never as links", () => {
    render(<ProcessCycle stages={stages} label="Example lifecycle (fixture)" />);
    const list = screen.getByRole("list", { name: "Example lifecycle (fixture)" });
    expect(list.tagName).toBe("OL");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("type"))).toEqual(["button", "button", "button"]);
    // The stage name is the button's name; its summary is its description.
    const two = screen.getByRole("button", { name: "Example stage two (fixture)" });
    expect(two.getAttribute("aria-pressed")).toBe("false");
    const describedBy = two.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)?.textContent).toBe(
      "Example summary two (fixture).",
    );
    // Line icons only (ADR-044): no raster images, and the icon is decorative.
    expect(list.querySelector("img")).toBeNull();
    expect(list.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("presents the pointed or focused stage in the centre, which is hidden from assistive tech", () => {
    const { container } = render(<ProcessCycle stages={stages} label="Example lifecycle" />);
    const centre = container.querySelector('[aria-hidden="true"].pointer-events-none');
    expect(centre?.textContent).toContain("Example stage one (fixture)");
    expect(centre?.textContent).not.toMatch(/\d+ \/ \d+/);
    expect(centre?.textContent).toContain("Example summary one (fixture).");
    fireEvent.pointerEnter(screen.getByRole("button", { name: /two/ }));
    expect(centre?.textContent).toContain("Example stage two (fixture)");
    expect(centre?.textContent).toContain("Example summary two (fixture).");
    fireEvent.focus(screen.getByRole("button", { name: /three/ }));
    expect(centre?.textContent).toContain("Example stage three (fixture)");
    expect(
      [...container.querySelectorAll("button[data-active]")].map((b) => b.textContent),
    ).toEqual([expect.stringContaining("Example stage three (fixture)")]);
    fireEvent.click(screen.getByRole("button", { name: /one/ }));
    expect(screen.getByRole("button", { name: /one/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("renders the finished ring on first paint: nothing held back for an entrance", () => {
    const { container } = render(<ProcessCycle stages={stages} label="Example lifecycle" />);
    expect(container.querySelector("[data-cycle]")?.getAttribute("data-cycle")).toBe("static");
    expect(container.querySelectorAll("li.scale-0")).toHaveLength(0);
  });

  it("renders nothing without stages", () => {
    const { container } = render(<ProcessCycle stages={[]} label="Example lifecycle" />);
    expect(container.textContent).toBe("");
  });
});
