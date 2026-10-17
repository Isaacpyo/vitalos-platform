// Writes docs/design/IMAGE-SLOTS.md and docs/review-2026-10-17/IMAGE-BRIEF.md from the image slot
// registry (apps/web/src/content/media-slots.ts). Node loads the registry directly (type
// stripping); it has no imports.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  renderImageBriefDoc,
  renderImageSlotsDoc,
} from "../../apps/web/src/content/media-slots.ts";

const outputs = [
  ["../../docs/design/IMAGE-SLOTS.md", renderImageSlotsDoc],
  ["../../docs/review-2026-10-17/IMAGE-BRIEF.md", renderImageBriefDoc],
];
for (const [relative, render] of outputs) {
  const target = fileURLToPath(new URL(relative, import.meta.url));
  writeFileSync(target, render());
  console.log(`Wrote ${target}`);
}
