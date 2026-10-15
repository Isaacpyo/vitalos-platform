/**
 * The image slot registry (pages redesign, 15 Oct 2026; docs/design/DECISIONS.md). Every
 * `<MediaSlot>` names one of these ids, and the type makes an unregistered id a compile error.
 * `pnpm media:slots` writes docs/design/IMAGE-SLOTS.md from this file, and a unit test fails when
 * the document is out of date.
 *
 * To add the real image: save it as `apps/web/public/media/{file}.{avif,webp,jpg,png}` at the
 * recommended size (for a per-item slot, `{file}` is the id, a dot, then the item's slug). The
 * slot renders it in place of the placeholder; nothing shifts, because the ratio is fixed here.
 *
 * Rules: real photography, screenshots or diagrams of Vitalos work only. No stock or
 * AI-generated imagery, and nothing that implies a client, outcome or person that is not real.
 *
 * This file has no imports, so `node` can load it directly (type stripping) for the doc script.
 */

export type MediaRatio = "16:9" | "4:3" | "1:1" | "3:2";

export interface MediaSlotEntry {
  id: string;
  page: string;
  section: string;
  ratio: MediaRatio;
  /** Recommended pixel size, width × height. */
  size: readonly [number, number];
  /** What the image should show. */
  brief: string;
  /** Draft alt text, for owner review. */
  alt: string;
  /** One image per item (for example per lab asset): the file is `{id}.{slug}`. */
  perItem?: boolean;
}

export const mediaSlots = [
  {
    id: "about.hero",
    page: "/about",
    section: "Hero",
    ratio: "4:3",
    size: [1600, 1200],
    brief:
      "A real photograph of the Vitalos team working together, or of the working space. No stock imagery.",
    alt: "The Vitalos team at work.",
  },
  {
    id: "careers.hero",
    page: "/careers",
    section: "Hero",
    ratio: "4:3",
    size: [1600, 1200],
    brief:
      "A real photograph of the team or the working space, suitable for people considering a role.",
    alt: "People at Vitalos working together.",
  },
  {
    id: "labs.asset",
    page: "/labs/[type]/[slug]",
    section: "Hero",
    ratio: "16:9",
    size: [1600, 900],
    brief:
      "A screenshot or diagram of the asset itself (framework page, harness output, assessment template). No decorative imagery.",
    alt: "A view of the lab asset.",
    perItem: true,
  },
  {
    id: "work.case-study",
    page: "/work/[slug]",
    section: "Hero",
    ratio: "16:9",
    size: [1600, 900],
    brief:
      "A screenshot or photograph of the delivered work, used only with the client's written permission.",
    alt: "The delivered work.",
    perItem: true,
  },
  {
    id: "insights.article",
    page: "/insights/[slug]",
    section: "Hero (article cover)",
    ratio: "16:9",
    size: [1600, 900],
    brief:
      "A cover that illustrates the article: a diagram, a screenshot or a real photograph. No stock or AI-generated imagery.",
    alt: "Cover image for the article.",
    perItem: true,
  },
] as const satisfies readonly MediaSlotEntry[];

export type MediaSlotId = (typeof mediaSlots)[number]["id"];

/** The registry entry for an id. */
export function mediaSlot(id: MediaSlotId): MediaSlotEntry {
  const entry = mediaSlots.find((slot) => slot.id === id);
  if (!entry) throw new Error(`Unregistered media slot: ${id}`);
  return entry;
}

const cell = (value: string): string => value.replaceAll("|", "\\|");

/** docs/design/IMAGE-SLOTS.md, generated from the registry (`pnpm media:slots`). */
export function renderImageSlotsDoc(): string {
  const rows = mediaSlots.map((slot: MediaSlotEntry) =>
    [
      `\`${slot.id}${slot.perItem ? ".{slug}" : ""}\``,
      `\`${slot.page}\``,
      slot.section,
      slot.ratio,
      `${slot.size[0]} × ${slot.size[1]}`,
      cell(slot.brief),
      cell(slot.alt),
    ].join(" | "),
  );
  return [
    "# Image slots",
    "",
    "Generated from `apps/web/src/content/media-slots.ts` by `pnpm media:slots`. Do not edit by hand.",
    "",
    "To add an image: save it as `apps/web/public/media/{id}.webp` (or `.avif`, `.jpg`, `.png`) at the recommended size; for a per-item slot, use `{id}.{slug}`, for example `labs.asset.production-ai-evaluation-harness.webp`.",
    "The slot shows it in place of the placeholder at the same ratio, so nothing shifts. Real photography, screenshots or diagrams only: no stock or AI-generated imagery.",
    "",
    "| Id | Page | Section | Ratio | Size (px) | Brief | Draft alt |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    "",
  ].join("\n");
}
