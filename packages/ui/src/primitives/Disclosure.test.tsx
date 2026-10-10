import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Disclosure } from "./Disclosure";

afterEach(cleanup);

describe("Disclosure", () => {
  it("is a native details element, closed by default, with its content in the DOM", () => {
    const { container } = render(
      <Disclosure summary="Example summary (fixture)">Example body (fixture)</Disclosure>,
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(container.querySelector("summary")?.textContent).toContain("Example summary (fixture)");
    expect(screen.getByText("Example body (fixture)")).toBeTruthy();
  });

  it("can start open", () => {
    const { container } = render(
      <Disclosure summary="Example summary (fixture)" open>
        Example body (fixture)
      </Disclosure>,
    );
    expect(container.querySelector("details")?.open).toBe(true);
  });

  it("toggles when the summary is activated and the summary is the focusable control", () => {
    const { container } = render(
      <Disclosure summary="Example summary (fixture)">Example body (fixture)</Disclosure>,
    );
    const summary = container.querySelector("summary") as HTMLElement;
    summary.focus();
    expect(document.activeElement).toBe(summary);
    fireEvent.click(summary);
    expect(container.querySelector("details")?.open).toBe(true);
  });

  it("hides the decorative chevron from assistive technology", () => {
    const { container } = render(
      <Disclosure summary="Example summary (fixture)">Example body (fixture)</Disclosure>,
    );
    expect(container.querySelector("summary svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
