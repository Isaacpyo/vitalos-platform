import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Checkbox } from "./Checkbox";
import { Field } from "./Field";
import { Select } from "./Select";
import { Textarea } from "./Textarea";
import { TextInput } from "./TextInput";

afterEach(cleanup);

describe("Field with TextInput", () => {
  it("associates the label, hint and control", () => {
    render(
      <Field label="Example label (fixture)" hint="Example hint (fixture)">
        <TextInput name="example" />
      </Field>,
    );
    const input = screen.getByLabelText("Example label (fixture)");
    expect(input.tagName).toBe("INPUT");
    const hint = screen.getByText("Example hint (fixture)");
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("sets aria-invalid and describes the control by hint and error", () => {
    render(
      <Field label="Example label (fixture)" hint="Hint" error="Example error (fixture)">
        <TextInput name="example" />
      </Field>,
    );
    const input = screen.getByLabelText("Example label (fixture)");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const described = (input.getAttribute("aria-describedby") ?? "").split(" ");
    expect(described).toHaveLength(2);
    const error = document.getElementById(described[1] ?? "");
    expect(error?.textContent).toContain("Example error (fixture)");
    // Colour is not the only signal: the error text has a hidden "Error:" prefix and an icon.
    expect(error?.textContent).toContain("Error:");
    expect(error?.querySelector("svg")).not.toBeNull();
  });

  it("applies required natively and shows the optional marker only when optional", () => {
    const { rerender } = render(
      <Field label="Example label (fixture)" required>
        <TextInput name="example" />
      </Field>,
    );
    expect(screen.getByLabelText<HTMLInputElement>("Example label (fixture)").required).toBe(true);
    expect(screen.queryByText("(optional)")).toBeNull();
    rerender(
      <Field label="Example label (fixture)" optional>
        <TextInput name="example" />
      </Field>,
    );
    expect(screen.getByText("(optional)")).toBeTruthy();
  });

  it("keeps the typed value and passes input attributes through", () => {
    render(
      <Field label="Work email (fixture)">
        <TextInput name="email" type="email" autoComplete="email" inputMode="email" />
      </Field>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Work email (fixture)");
    fireEvent.change(input, { target: { value: "person@example.invalid" } });
    expect(input.value).toBe("person@example.invalid");
    expect(input.type).toBe("email");
    expect(input.autocomplete).toBe("email");
    expect(input.getAttribute("inputmode")).toBe("email");
  });

  it("is keyboard focusable", () => {
    render(
      <Field label="Example label (fixture)">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText("Example label (fixture)");
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it("generates unique ids for separate fields", () => {
    render(
      <>
        <Field label="One (fixture)">
          <TextInput />
        </Field>
        <Field label="Two (fixture)">
          <TextInput />
        </Field>
      </>,
    );
    expect(screen.getByLabelText("One (fixture)").id).not.toBe(
      screen.getByLabelText("Two (fixture)").id,
    );
  });

  it("still works standalone, outside a Field", () => {
    render(<TextInput aria-label="Standalone (fixture)" />);
    expect(screen.getByLabelText("Standalone (fixture)").tagName).toBe("INPUT");
  });
});

describe("Field with Textarea and Select", () => {
  it("wires a textarea", () => {
    render(
      <Field label="Free text (fixture)" error="Example error (fixture)">
        <Textarea name="goal" />
      </Field>,
    );
    const textarea = screen.getByLabelText("Free text (fixture)");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
  });

  it("wires a native select and its options", () => {
    render(
      <Field label="Choice (fixture)">
        <Select name="choice" defaultValue="b">
          <option value="a">Option A (fixture)</option>
          <option value="b">Option B (fixture)</option>
        </Select>
      </Field>,
    );
    const select = screen.getByLabelText<HTMLSelectElement>("Choice (fixture)");
    expect(select.tagName).toBe("SELECT");
    expect(select.value).toBe("b");
    fireEvent.change(select, { target: { value: "a" } });
    expect(select.value).toBe("a");
  });
});

describe("Checkbox", () => {
  it("is not pre-ticked and toggles", () => {
    render(<Checkbox name="consent" label="Example consent (fixture)" />);
    const box = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Example consent (fixture)",
    });
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
  });

  it("describes the control by hint and error and marks it invalid", () => {
    render(
      <Checkbox
        label="Example consent (fixture)"
        hint="Example hint (fixture)"
        error="Example error (fixture)"
      />,
    );
    const box = screen.getByRole("checkbox");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    const ids = (box.getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0] ?? "")?.textContent).toBe("Example hint (fixture)");
  });

  it("allows a link inside the label", () => {
    render(
      <Checkbox
        label={
          <>
            I accept the <a href="/legal/privacy">privacy notice</a>
          </>
        }
      />,
    );
    expect(screen.getByRole("link", { name: "privacy notice" }).getAttribute("href")).toBe(
      "/legal/privacy",
    );
  });
});
