import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("renders a plain anchor when href is given", () => {
    render(<Button href="/contact">Talk to Vitalos</Button>);
    const link = screen.getByRole("link", { name: "Talk to Vitalos" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/contact");
    expect(link.getAttribute("type")).toBeNull();
  });

  it("renders a button of type=button by default so it never submits a form by accident", () => {
    render(<Button>Example action (fixture)</Button>);
    const button = screen.getByRole("button", { name: "Example action (fixture)" });
    expect(button.getAttribute("type")).toBe("button");
  });

  it("calls onClick for the button form", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Example action (fixture)</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Example action (fixture)
      </Button>,
    );
    const button = screen.getByRole<HTMLButtonElement>("button");
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is keyboard focusable as a link and as a button (natively, with no tabindex override)", () => {
    render(
      <>
        <Button href="/a">Link</Button>
        <Button>Action</Button>
      </>,
    );
    for (const el of [screen.getByRole("link"), screen.getByRole("button")]) {
      el.focus();
      expect(document.activeElement).toBe(el);
      expect(el.getAttribute("tabindex")).toBeNull();
    }
  });

  it("forces the contrast treatment for a surface with theme", () => {
    render(
      <Button href="/a" theme="dark">
        On midnight
      </Button>,
    );
    expect(screen.getByRole("link").getAttribute("data-tone")).toBe("dark");
  });

  it("exposes variants and sizes as classes, with pressed and disabled states in the contract", () => {
    render(
      <Button variant="secondary" size="sm">
        Secondary
      </Button>,
    );
    const className = screen.getByRole("button").className;
    expect(className).toContain("hover:");
    expect(className).toContain("active:");
    expect(className).toContain("disabled:");
    expect(className).toContain("min-h-(--size-button-sm)");
  });

  it("passes aria attributes through", () => {
    render(<Button aria-label="Close menu">x</Button>);
    expect(screen.getByRole("button", { name: "Close menu" })).toBeTruthy();
  });
});
