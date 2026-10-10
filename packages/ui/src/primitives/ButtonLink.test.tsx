import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ButtonLink } from "./ButtonLink";

afterEach(cleanup);

describe("ButtonLink", () => {
  it("renders a plain anchor with its label and href", () => {
    render(<ButtonLink href="/contact">Talk to Vitalos</ButtonLink>);
    const link = screen.getByRole("link", { name: "Talk to Vitalos" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/contact");
  });
});
