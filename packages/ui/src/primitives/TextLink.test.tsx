import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TextLink } from "./TextLink";

afterEach(cleanup);

describe("TextLink", () => {
  it("renders a plain anchor with an accessible name that excludes the decorative arrow", () => {
    render(<TextLink href="/example">Example link (fixture)</TextLink>);
    const link = screen.getByRole("link", { name: "Example link (fixture)" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/example");
    const svg = link.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("can omit the arrow", () => {
    render(
      <TextLink href="/example" arrow={false}>
        Example link (fixture)
      </TextLink>,
    );
    expect(screen.getByRole("link").querySelector("svg")).toBeNull();
  });

  it("is keyboard focusable", () => {
    render(<TextLink href="/example">Example link (fixture)</TextLink>);
    const link = screen.getByRole("link");
    link.focus();
    expect(document.activeElement).toBe(link);
  });
});
