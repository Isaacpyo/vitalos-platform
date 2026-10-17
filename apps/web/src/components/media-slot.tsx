import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { Icon } from "@vitalos/ui";
import {
  mediaSlot,
  type MediaRatio,
  type MediaSlotEntry,
  type MediaSlotId,
} from "../content/media-slots";

const extensions = ["avif", "webp", "jpg", "png"] as const;

const ratioClass: Record<MediaRatio, string> = {
  "16:9": "aspect-[16/9]",
  "4:3": "aspect-[4/3]",
  "3:2": "aspect-[3/2]",
  "1:1": "aspect-square",
};

/**
 * Labels show in development and on Vercel previews, never in production. `NEXT_PUBLIC_MEDIA_LABELS`
 * overrides: "1" shows them, "0" hides them.
 */
function labelsShown(): boolean {
  const flag = process.env["NEXT_PUBLIC_MEDIA_LABELS"];
  if (flag === "1") return true;
  if (flag === "0") return false;
  return process.env.NODE_ENV === "development" || process.env["VERCEL_ENV"] === "preview";
}

/**
 * Placeholders show where labels show (development, previews, or `NEXT_PUBLIC_MEDIA_LABELS=1`).
 * In production a missing image renders nothing (finding A5, ADR-044), unless the slot is
 * registered with `reserve`.
 */
function placeholderShown(slot: MediaSlotEntry): boolean {
  return labelsShown() || slot.reserve === true;
}

/** The public path of the slot's file, when one has been added. */
function findFile(file: string): string | undefined {
  for (const extension of extensions) {
    const name = `${file}.${extension}`;
    if (existsSync(path.join(process.cwd(), "public", "media", name))) return `/media/${name}`;
  }
  return undefined;
}

/** The registry's draft alt with `{name}` filled in (or a neutral word when no title is given). */
export const draftAlt = (template: string, itemName: string | undefined): string =>
  template.replaceAll("{name}", itemName?.trim() || "this item");

const fileFor = (slot: MediaSlotEntry, id: MediaSlotId, item: string | undefined): string =>
  slot.perItem && item ? `${id}.${item}` : id;

/**
 * Whether the slot renders anything: its file exists, or a placeholder is shown here. Callers
 * that give the slot a column of its own (a hero's media) pass the slot only when this is true,
 * so the layout closes up instead of keeping an empty column.
 */
export function mediaSlotRenders(id: MediaSlotId, item?: string): boolean {
  const slot = mediaSlot(id);
  return findFile(fileFor(slot, id, item)) !== undefined || placeholderShown(slot);
}

export interface MediaSlotProps {
  id: MediaSlotId;
  /** The item's slug, for a per-item slot (for example a lab asset). */
  item?: string | undefined;
  /** The item's title: fills `{name}` in the registry's draft alt. */
  itemName?: string | undefined;
  /** Alt text; defaults to the registry's draft alt. Pass "" for a decorative image. */
  alt?: string | undefined;
  /** Above-the-fold images (heroes). */
  priority?: boolean | undefined;
  /** Responsive sizes hint; defaults to the hero column (5/12 from lg). */
  sizes?: string | undefined;
  className?: string | undefined;
}

/**
 * One place for every page image that does not exist yet (docs/design/IMAGE-SLOTS.md). When
 * `public/media/{id}[.{item}].{avif,webp,jpg,png}` exists it renders that file. Otherwise, in
 * development and on previews, a branded placeholder at the exact ratio with its label; in
 * production nothing at all (no frame, no reserved space), unless the slot is registered with
 * `reserve`, which keeps the unlabelled frame. The placeholder is decorative (hidden from
 * assistive technology). Files are served pre-sized, without the image optimiser, like CmsImage.
 */
export function MediaSlot({
  id,
  item,
  itemName,
  alt,
  priority,
  sizes,
  className,
}: Readonly<MediaSlotProps>) {
  const slot = mediaSlot(id);
  const file = fileFor(slot, id, item);
  const src = findFile(file);
  const frame = `relative block w-full overflow-hidden rounded-2xl ${ratioClass[slot.ratio]} ${className ?? ""}`;
  if (src) {
    return (
      <span className={frame}>
        <Image
          src={src}
          alt={alt ?? draftAlt(slot.alt, itemName)}
          width={slot.size[0]}
          height={slot.size[1]}
          sizes={sizes ?? "(min-width: 1024px) 42vw, 100vw"}
          unoptimized
          className="size-full object-cover"
          {...(priority ? { priority: true } : {})}
        />
      </span>
    );
  }
  if (!placeholderShown(slot)) return null;
  return (
    <span
      aria-hidden="true"
      data-media-slot={file}
      className={`${frame} flex flex-col items-center justify-center gap-(--space-3) border border-tone-border bg-tone-tile-bg text-tone-muted`}
    >
      <Icon name="image" size={32} />
      {labelsShown() ? (
        <span className="px-(--space-4) text-center font-mono text-small tracking-wide break-all uppercase">
          IMAGE · {slot.ratio} · {file}
        </span>
      ) : null}
    </span>
  );
}
