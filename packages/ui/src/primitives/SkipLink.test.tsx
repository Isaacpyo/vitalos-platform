import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkipLink } from "./SkipLink";

afterEach(cleanup);

describe("SkipLink", () => {
  it("is a plain in-page anchor to the main landmark", () => {
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#main");
  });

  it("is hidden until focused and then revealed above other content", () => {
    render(<SkipLink href="#content" />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("sr-only");
    expect(link.className).toContain("focus:not-sr-only");
    expect(link.className).toContain("focus:z-50");
  });

  it("is the first tab stop when placed first and can receive focus", () => {
    render(
      <>
        <SkipLink />
        <a href="/other">Other</a>
      </>,
    );
    const first = screen.getAllByRole("link")[0];
    first?.focus();
    expect(document.activeElement).toBe(first);
  });
});
