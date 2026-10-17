import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SubmitButton } from "./SubmitButton";

afterEach(cleanup);

describe("SubmitButton", () => {
  it("is a submit button with its label", () => {
    render(
      <form>
        <SubmitButton>Example submit (fixture)</SubmitButton>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Example submit (fixture)" });
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("shows progress and blocks repeat submission while the form action is pending", async () => {
    let finish: () => void = () => undefined;
    let calls = 0;
    const action = () => {
      calls += 1;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    };
    render(
      <form action={action}>
        <SubmitButton pendingLabel="Sending (fixture)">Example submit (fixture)</SubmitButton>
      </form>,
    );
    const form = screen.getByRole("button").closest("form") as HTMLFormElement;
    await act(() => {
      fireEvent.submit(form);
      return Promise.resolve();
    });
    const pending = screen.getByRole("button", { name: "Sending (fixture)" });
    expect(pending.getAttribute("aria-busy")).toBe("true");
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    expect(pending.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(calls).toBe(1);
    await act(() => {
      finish();
      return Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Example submit (fixture)" })).toBeTruthy();
  });
});
