import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogTrigger } from "./Dialog";
import { Drawer, DrawerContent, DrawerTrigger } from "./Drawer";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Tabs, TabsList, TabsPanel, TabsTab } from "./Tabs";
import { ToastProvider } from "./Toast";

afterEach(cleanup);

/**
 * CSP (ADR-020, ADR-054). Base UI injects an inline `<style>` (ScrollArea, Select) or an inline
 * `<script>` (Slider thumb, Tabs.Indicator) only in those parts, and none of them is wrapped. The
 * site's policy keeps 'unsafe-inline' today, but its strict report-only variant drops it for
 * scripts, so nothing here may depend on either: no wrapped component renders either element.
 */
describe("CSP compatibility", () => {
  it("renders no <style> or <script> element for open overlays, tabs or toasts", async () => {
    render(
      <ToastProvider>
        <Popover defaultOpen>
          <PopoverTrigger>P (fixture)</PopoverTrigger>
          <PopoverContent title="Popover (fixture)">Body (fixture)</PopoverContent>
        </Popover>
        <Dialog>
          <DialogTrigger>D (fixture)</DialogTrigger>
          <DialogContent title="Dialog (fixture)">Body (fixture)</DialogContent>
        </Dialog>
        <Drawer>
          <DrawerTrigger>R (fixture)</DrawerTrigger>
          <DrawerContent title="Drawer (fixture)">Body (fixture)</DrawerContent>
        </Drawer>
        <Tabs defaultValue="a">
          <TabsList aria-label="T (fixture)">
            <TabsTab value="a">A (fixture)</TabsTab>
          </TabsList>
          <TabsPanel value="a">Panel (fixture)</TabsPanel>
        </Tabs>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "D (fixture)" }));
    await screen.findByRole("dialog", { name: "Dialog (fixture)" });
    expect(document.querySelectorAll("style, script")).toHaveLength(0);
  });
});
