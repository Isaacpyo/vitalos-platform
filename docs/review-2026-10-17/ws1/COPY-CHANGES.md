# WS1 copy changes

WS1 changes presentation only. No new public sentence was written. Every label below already existed in `apps/web/src/lib/view-mapping/labels.ts` (structural labels) or in the offer's own content fields (`packages/cms/src/draft/content/offers.ts`).

| Page | Before | After | Source |
|---|---|---|---|
| `/offers/[slug]` hero | Icon in a frosted card with a chip "Typical duration: {duration}" | Engagement panel titled "Engagement summary" with "Typical duration", "Who this is for", "What you receive" (first three outputs) and "How this connects to the next phase", each from the offer's fields; empty fields are left out | Structural labels `engagement`, `duration`, `audience`, `outputs`, `nextStep`; offer fields `durationCategory`, `audience`, `outputs`, `nextStep` |
| `/offers/[slug]` "Engagement summary" band | Five rows: who it is for, trigger, what Vitalos does, duration, next phase | Two rows: trigger, what Vitalos does (the other three are in the hero panel) | Same fields; nothing added |
| `/careers/[slug]` hero action | Apply button in the secondary (on-dark) style | Apply button in the primary style (the hero is now light) | Same label |

Image alt text: unchanged. All artwork is decorative (`aria-hidden`); no `alt` text was added or removed on content images.
