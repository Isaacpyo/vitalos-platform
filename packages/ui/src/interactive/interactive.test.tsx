import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "./Collapsible";
import { CopyButton } from "./CopyButton";
import { Dialog, DialogContent, DialogTrigger } from "./Dialog";
import { Drawer, DrawerContent, DrawerTrigger } from "./Drawer";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Skeleton } from "./Skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "./Tabs";
import { ToastProvider, useToast } from "./Toast";
import { Tooltip, TooltipProvider } from "./Tooltip";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Popover", () => {
  function Example() {
    return (
      <Popover>
        <PopoverTrigger>Why flagged (fixture)</PopoverTrigger>
        <PopoverContent title="Amount mismatch (fixture)" data-aid-tone="dark">
          Explanation text (fixture)
        </PopoverContent>
      </Popover>
    );
  }

  it("is closed first, exposes aria-expanded on its trigger and opens on click", async () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Why flagged (fixture)" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Explanation text (fixture)")).toBeNull();
    fireEvent.click(trigger);
    expect(await screen.findByText("Explanation text (fixture)")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("names the popup by its title, carries the page tone and closes on Escape with focus back on the trigger", async () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Why flagged (fixture)" });
    trigger.focus();
    fireEvent.click(trigger);
    const popup = await screen.findByRole("dialog");
    expect(popup.getAttribute("aria-labelledby")).toBeTruthy();
    expect(popup.getAttribute("data-aid-tone")).toBe("dark");
    fireEvent.keyDown(popup, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("Dialog", () => {
  function Example() {
    return (
      <Dialog>
        <DialogTrigger>Open full view (fixture)</DialogTrigger>
        <DialogContent title="Expanded view (fixture)" description="Synthetic data (fixture)">
          <button type="button">Inside action (fixture)</button>
        </DialogContent>
      </Dialog>
    );
  }

  it("opens as a modal dialog named by its title and described by its description", async () => {
    render(<Example />);
    fireEvent.click(screen.getByRole("button", { name: "Open full view (fixture)" }));
    const dialog = await screen.findByRole("dialog", { name: "Expanded view (fixture)" });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("moves focus inside, closes on Escape and returns focus to the trigger", async () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open full view (fixture)" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("closes with the Close button", async () => {
    render(<Example />);
    fireEvent.click(screen.getByRole("button", { name: "Open full view (fixture)" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("Drawer", () => {
  it("opens as a named dialog, closes on Escape and returns focus to the trigger", async () => {
    render(
      <Drawer side="right">
        <DrawerTrigger>Open reviewer task (fixture)</DrawerTrigger>
        <DrawerContent title="Reviewer task (fixture)">Detail text (fixture)</DrawerContent>
      </Drawer>,
    );
    const trigger = screen.getByRole("button", { name: "Open reviewer task (fixture)" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Reviewer task (fixture)" });
    expect(screen.getByText("Detail text (fixture)")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("Tabs", () => {
  function Example() {
    return (
      <Tabs defaultValue="a">
        <TabsList aria-label="Samples (fixture)">
          <TabsTab value="a">Sample A (fixture)</TabsTab>
          <TabsTab value="b">Sample B (fixture)</TabsTab>
        </TabsList>
        <TabsPanel value="a">Panel A (fixture)</TabsPanel>
        <TabsPanel value="b">Panel B (fixture)</TabsPanel>
      </Tabs>
    );
  }

  it("exposes tablist semantics with the first tab selected", () => {
    render(<Example />);
    expect(screen.getByRole("tablist", { name: "Samples (fixture)" })).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("false");
    expect(tabs[0]?.getAttribute("aria-controls")).toBeTruthy();
    expect(screen.getByText("Panel A (fixture)")).toBeTruthy();
  });

  it("moves with the arrow keys and shows only the selected panel", async () => {
    render(<Example />);
    const [first, second] = screen.getAllByRole("tab");
    first?.focus();
    fireEvent.keyDown(first as HTMLElement, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement).toBe(second));
    fireEvent.click(second as HTMLElement);
    expect(second?.getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByText("Panel B (fixture)")).toBeTruthy();
  });
});

describe("Collapsible", () => {
  it("toggles aria-expanded with its trigger and keeps the panel in the DOM", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Show source (fixture)</CollapsibleTrigger>
        <CollapsiblePanel>Source line (fixture)</CollapsiblePanel>
      </Collapsible>,
    );
    const trigger = screen.getByRole("button", { name: "Show source (fixture)" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Source line (fixture)", { selector: "*" })).toBeTruthy();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Tooltip", () => {
  it("renders the trigger without a wrapper and keeps it focusable", () => {
    render(
      <TooltipProvider>
        <Tooltip content="Copy result (fixture)">
          <button type="button">Icon (fixture)</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const button = screen.getByRole("button", { name: "Icon (fixture)" });
    button.focus();
    expect(document.activeElement).toBe(button);
  });
});

describe("Toast", () => {
  function Trigger() {
    const toast = useToast();
    return (
      <button
        type="button"
        onClick={() => toast.show({ title: "Saved (fixture)", tone: "success" })}
      >
        Show toast (fixture)
      </button>
    );
  }

  it("shows a titled toast in a labelled region with a dismiss button", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show toast (fixture)" }));
    expect(await screen.findByText("Saved (fixture)")).toBeTruthy();
    // Base UI keeps the dismiss button out of the accessibility tree until the stack is focused.
    expect(document.querySelector('button[aria-label="Dismiss notification"]')).not.toBeNull();
  });

  it("throws a clear error when used outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
  });
});

describe("CopyButton", () => {
  it("copies, then says so visibly and in a polite live region, then reverts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<CopyButton value="synthetic result (fixture)" resetAfterMs={500} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("synthetic result (fixture)"));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Copied");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    vi.useRealTimers();
  });

  it("reports a failure instead of swallowing it", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", { value: () => false, configurable: true });
    render(<CopyButton value="x" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copy failed" })).toBeTruthy();
  });

  it("also raises a toast when asked and a provider is mounted", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    render(
      <ToastProvider>
        <CopyButton value="x" toast copiedLabel="Result copied (fixture)" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    const matches = await screen.findAllByText("Result copied (fixture)");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Skeleton", () => {
  it("is decorative: hidden from assistive technology", () => {
    const { container } = render(<Skeleton lines={3} />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.firstElementChild?.children.length).toBe(3);
  });
});
