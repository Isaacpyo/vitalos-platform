import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FormErrorSummary } from "./FormErrorSummary";

afterEach(cleanup);

const errors = [
  { fieldId: "name", message: "Enter a name (fixture)" },
  { fieldId: "email", message: "Enter an email address (fixture)" },
];

describe("FormErrorSummary", () => {
  it("renders nothing without errors", () => {
    const { container } = render(<FormErrorSummary errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("is an alert that links each message to its field", () => {
    render(<FormErrorSummary errors={errors} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Enter a name (fixture)" });
    expect(link.getAttribute("href")).toBe("#name");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("is named by its heading", () => {
    render(<FormErrorSummary errors={errors} title="Example heading (fixture)" />);
    expect(screen.getByRole("alert", { name: "Example heading (fixture)" })).toBeTruthy();
  });

  it("moves keyboard focus to the summary when errors appear", () => {
    const { rerender } = render(<FormErrorSummary errors={[]} />);
    rerender(<FormErrorSummary errors={errors} />);
    expect(document.activeElement).toBe(screen.getByRole("alert"));
  });

  it("refocuses on a new failed submission when focusKey changes", () => {
    const { rerender } = render(<FormErrorSummary errors={errors} focusKey={1} />);
    const link = screen.getAllByRole("link")[0];
    link?.focus();
    expect(document.activeElement).toBe(link);
    rerender(<FormErrorSummary errors={errors} focusKey={2} />);
    expect(document.activeElement).toBe(screen.getByRole("alert"));
  });
});
