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
 * Production (17 Oct 2026, finding A5; ADR-044): a slot whose file is missing renders nothing and
 * takes no space, so a page never shows an empty frame. A slot marked `reserve` keeps its frame
 * (for a layout that would break without it). Development and previews keep the labelled
 * placeholder so the gap stays visible to editors.
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
  /**
   * Draft alt text, for owner review. In a per-item slot, `{name}` is replaced by the item's
   * title (MediaSlot `itemName`), so each image says what it shows (docs/seo/AUDIT.md).
   */
  alt: string;
  /** One image per item (for example per lab asset): the file is `{id}.{slug}`. */
  perItem?: boolean;
  /** Who could supply it: a real, rights-cleared source (never stock, never generated). */
  source: string;
  /** Keep the empty frame in production while the file is missing. Default: collapse. */
  reserve?: boolean;
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
    source:
      "A commissioned photographer, or a team member with a good camera, at the Vitalos working space. Everyone shown agrees in writing.",
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
    source:
      "A commissioned photographer, or a team member, at the Vitalos working space. Everyone shown agrees in writing.",
  },
  {
    id: "labs.asset",
    page: "/labs/[type]/[slug]",
    section: "Hero",
    ratio: "16:9",
    size: [1600, 900],
    brief:
      "A screenshot or diagram of the asset itself (framework page, harness output, assessment template). No decorative imagery.",
    alt: "A view of {name}.",
    perItem: true,
    source: "The team member who built the asset: a screenshot or an exported diagram.",
  },
  {
    id: "work.case-study",
    page: "/work/[slug]",
    section: "Hero",
    ratio: "16:9",
    size: [1600, 900],
    brief:
      "A screenshot or photograph of the delivered work, used only with the client's written permission.",
    alt: "The delivered work: {name}.",
    perItem: true,
    source: "The delivery team, with the client's written permission for the specific image.",
  },
  {
    id: "insights.article",
    page: "/insights/[slug]",
    section: "Hero (article cover)",
    ratio: "16:9",
    size: [1600, 900],
    brief:
      "A cover that illustrates the article: a diagram, a screenshot or a real photograph. No stock or AI-generated imagery. Covers are uploaded in the Super Admin (Insights › Posts › Cover, ADR-039); an article without one shows no hero image.",
    alt: "Cover image for {name}.",
    perItem: true,
    source: "The article's author or the editor, uploaded in the Super Admin.",
  },
  {
    id: "about.founder",
    page: "/about",
    section: "Founder (behind ABOUT_FOUNDER_ENABLED)",
    ratio: "1:1",
    size: [800, 800],
    brief:
      "A real portrait of the founder, head and shoulders, natural light, plain background. Used only with their agreement.",
    alt: "Portrait of {name}.",
    source: "A commissioned photographer, or the founder's own approved portrait.",
  },
  {
    id: "insights.author",
    page: "/insights/[slug]",
    section: "Author block",
    ratio: "1:1",
    size: [400, 400],
    brief:
      "A real portrait of the author, head and shoulders. Without one the author block shows initials.",
    alt: "Portrait of {name}.",
    perItem: true,
    source: "The author's own approved portrait, or one taken by a commissioned photographer.",
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

/**
 * docs/review-2026-10-17/IMAGE-BRIEF.md (17 Oct 2026 review, finding A5): the same registry as a
 * commissioning brief, with who could supply each image and what production does without it.
 */
export function renderImageBriefDoc(): string {
  const rows = mediaSlots.map((slot: MediaSlotEntry) =>
    [
      `\`${slot.id}${slot.perItem ? ".{slug}" : ""}\``,
      `\`${slot.page}\``,
      slot.section,
      slot.ratio,
      `${slot.size[0]} × ${slot.size[1]}`,
      cell(slot.brief),
      cell(slot.source),
      slot.reserve ? "Keeps an empty frame" : "Renders nothing",
    ].join(" | "),
  );
  return [
    "# Image brief",
    "",
    "Generated from `apps/web/src/content/media-slots.ts` by `pnpm media:slots`. Do not edit by hand.",
    "",
    "Every place on the public site where a real photograph, screenshot or diagram could go. None of these images exists yet. Until one does, production renders nothing in its place and the layout closes up; development and previews show a labelled placeholder. The hero artwork of every page is drawn in code from the brand's graphic language (ADR-044) and needs no image.",
    "",
    "Rules: real, rights-cleared images only. No stock photography, no AI-generated images, no people who have not agreed in writing, and nothing that implies a client, outcome or person that is not real. Save the file as `apps/web/public/media/{id}.webp` (per item: `{id}.{slug}.webp`) at the size given.",
    "",
    "| Slot | Page | Section | Ratio | Size (px) | What it should show | Who could supply it | Production without it |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    "",
  ].join("\n");
}
