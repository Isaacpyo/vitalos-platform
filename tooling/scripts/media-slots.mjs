// Writes docs/design/IMAGE-SLOTS.md from the image slot registry (apps/web/src/content/media-slots.ts).
// Node loads the registry directly (type stripping); it has no imports.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderImageSlotsDoc } from "../../apps/web/src/content/media-slots.ts";

const target = fileURLToPath(new URL("../../docs/design/IMAGE-SLOTS.md", import.meta.url));
writeFileSync(target, renderImageSlotsDoc());
console.log(`Wrote ${target}`);
