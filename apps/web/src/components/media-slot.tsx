import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { Icon } from "@vitalos/ui";
import { mediaSlot, type MediaRatio, type MediaSlotId } from "../content/media-slots";

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
 * `public/media/{id}[.{item}].{avif,webp,jpg,png}` exists it renders that file; otherwise a
 * branded placeholder at the exact ratio, so nothing shifts when the real image arrives. The
 * placeholder is decorative (hidden from assistive technology); its label shows in development
 * and on previews only. Files are served pre-sized, without the image optimiser, like CmsImage.
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
  const file = slot.perItem && item ? `${id}.${item}` : id;
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
