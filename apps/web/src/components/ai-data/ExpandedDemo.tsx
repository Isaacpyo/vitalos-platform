"use client";

import { Dialog, DialogContent, ToastProvider } from "@vitalos/ui/interactive";
import { demoSamples } from "../../features/ai-data/demonstrator-samples";
import { ReconWorkbench } from "./ReconWorkbench";

/**
 * The expanded demonstration: the same reconciliation work surface as the demonstrator page, in
 * a dialog, opened from the hero. Loaded on demand with `next/dynamic` (it carries Base UI's
 * dialog and toast), so the home page's first load does not include it. Focus is trapped while
 * open and returns to the button that opened it on close.
 */
export default function ExpandedDemo({ onClose }: Readonly<{ onClose: () => void }>) {
  return (
    <ToastProvider viewportAttributes={{ "data-aid-tone": "dark" }}>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          size="wide"
          data-aid-tone="dark"
          title="Supplier statement reconciliation"
          description="Scripted example on synthetic data. Not live AI."
        >
          <ReconWorkbench
            samples={demoSamples}
            defaultSampleId="missing-mismatch"
            surface="expanded"
            tone="dark"
          />
        </DialogContent>
      </Dialog>
    </ToastProvider>
  );
}
