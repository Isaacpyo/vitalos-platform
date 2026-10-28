import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  CopyButton,
  Dialog,
  DialogContent,
  DialogTrigger,
  Drawer,
  DrawerContent,
  DrawerTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  ToastProvider,
} from "@vitalos/ui/interactive";
import { Button } from "@vitalos/ui";
import { Frame, sample } from "./_frame";

/**
 * Base UI based interactive primitives (ADR-054). Overlays render closed by default so the
 * storybook-a11y job scans the page as a visitor first sees it; `OpenPopover` scans an open one.
 */
const meta = {
  title: "Primitives/Interactive",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const triggerClass =
  "inline-flex min-h-11 items-center rounded-md border border-tone-control-border px-4 text-small font-semibold text-tone-heading";

export const Overlays: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-wrap gap-4">
        <Popover>
          <PopoverTrigger className={triggerClass}>Popover (fixture)</PopoverTrigger>
          <PopoverContent title="Popover title (fixture)">{sample.paragraph}</PopoverContent>
        </Popover>
        <Dialog>
          <DialogTrigger className={triggerClass}>Dialog (fixture)</DialogTrigger>
          <DialogContent title="Dialog title (fixture)" description={sample.label}>
            <p className="m-0">{sample.paragraph}</p>
          </DialogContent>
        </Dialog>
        <Drawer>
          <DrawerTrigger className={triggerClass}>Drawer (fixture)</DrawerTrigger>
          <DrawerContent title="Drawer title (fixture)">
            <p className="m-0">{sample.paragraph}</p>
          </DrawerContent>
        </Drawer>
      </div>
    </Frame>
  ),
};

export const OpenPopover: Story = {
  render: () => (
    <Frame>
      <div className="min-h-64">
        <Popover defaultOpen>
          <PopoverTrigger className={triggerClass}>Popover (fixture)</PopoverTrigger>
          <PopoverContent title="Popover title (fixture)">{sample.paragraph}</PopoverContent>
        </Popover>
      </div>
    </Frame>
  ),
};

export const TabsAndCollapsible: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-col gap-6">
        <Tabs defaultValue="a">
          <TabsList aria-label="Example tabs (fixture)">
            <TabsTab value="a">Tab A (fixture)</TabsTab>
            <TabsTab value="b">Tab B (fixture)</TabsTab>
          </TabsList>
          <TabsPanel value="a" className="pt-4">
            {sample.paragraph}
          </TabsPanel>
          <TabsPanel value="b" className="pt-4">
            {sample.paragraph}
          </TabsPanel>
        </Tabs>
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Show the source line (fixture)</CollapsibleTrigger>
          <CollapsiblePanel>
            <p className="m-0 pt-2">{sample.paragraph}</p>
          </CollapsiblePanel>
        </Collapsible>
      </div>
    </Frame>
  ),
};

export const CopyAndToast: Story = {
  render: () => (
    <ToastProvider>
      <Frame>
        <div className="flex flex-wrap gap-4">
          <CopyButton value={sample.paragraph} toast />
          <Button variant="secondary">Example action (fixture)</Button>
        </div>
      </Frame>
    </ToastProvider>
  ),
};

export const LoadingSkeleton: Story = {
  render: () => (
    <Frame>
      <div aria-busy="true" className="flex max-w-md flex-col gap-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton lines={3} />
      </div>
    </Frame>
  ),
};
