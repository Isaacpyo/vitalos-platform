import { existsSync } from "node:fs";
import path from "node:path";
import { Icon } from "@vitalos/ui";
import { mediaSlot, type MediaRatio, type MediaSlotId } from "../content/media-slots";

const extensions = ["avif", "webp", "jpg", "png"] as const;
type Extension = (typeof extensions)[number];

const mimeTypes: Record<Extension, string> = {
  avif: "image/avif",
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

const ratioClass: Record<MediaRatio, string> = {
  "16:9": "aspect-[16/9]",
  "4:3": "aspect-[4/3]",
  "3:2": "aspect-[3/2]",
  "1:1": "aspect-square",
  "21:9": "aspect-[21/9]",
  "5:7": "aspect-[5/7]",
};

/** The ratio from md, when a slot's phone version has its own ratio below md. */
const mdRatioClass: Record<MediaRatio, string> = {
  "16:9": "md:aspect-[16/9]",
  "4:3": "md:aspect-[4/3]",
  "3:2": "md:aspect-[3/2]",
  "1:1": "md:aspect-square",
  "21:9": "md:aspect-[21/9]",
  "5:7": "md:aspect-[5/7]",
};

/** Below this width a slot with a phone version shows it (Tailwind md). */
const phoneQuery = "(max-width: 47.99rem)";

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

const exists = (name: string) => existsSync(path.join(process.cwd(), "public", "media", name));

interface SlotSource {
  type: string;
  srcSet: string;
  src: string;
}

/**
 * The formats the slot's file exists in, best first. Each has the full-size file and, when one
 * was added, a half-size `{file}@1x` file, so the browser picks by the rendered width.
 */
function sourcesFor(file: string, width: number): SlotSource[] {
  return extensions.flatMap((extension) => {
    const full = `${file}.${extension}`;
    if (!exists(full)) return [];
    const half = `${file}@1x.${extension}`;
    const srcSet = [
      ...(exists(half) ? [`/media/${half} ${Math.round(width / 2)}w`] : []),
      `/media/${full} ${width}w`,
    ].join(", ");
    return [{ type: mimeTypes[extension], srcSet, src: `/media/${full}` }];
  });
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
 * and on previews only. Files are served pre-sized, without the image optimiser, like CmsImage:
 * every format present (AVIF before WebP), an optional half-size `@1x` file, and for a slot with
 * a phone version, `{file}.mobile` below md at its own ratio.
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
  const wide = sourcesFor(file, slot.size[0]);
  const phone = slot.mobile ? sourcesFor(`${file}.mobile`, slot.mobile.size[0]) : [];
  const aspect =
    slot.mobile && phone.length > 0
      ? `${ratioClass[slot.mobile.ratio]} ${mdRatioClass[slot.ratio]}`
      : ratioClass[slot.ratio];
  const frame = `relative block w-full overflow-hidden rounded-2xl ${aspect} ${className ?? ""}`;
  const fallback = wide.at(-1);
  if (fallback) {
    const sizesHint = sizes ?? "(min-width: 1024px) 42vw, 100vw";
    return (
      <span className={frame}>
        <picture>
          {slot.mobile
            ? phone.map((source) => (
                <source
                  key={`phone-${source.type}`}
                  media={phoneQuery}
                  type={source.type}
                  srcSet={source.srcSet}
                  sizes={sizesHint}
                  width={slot.mobile?.size[0]}
                  height={slot.mobile?.size[1]}
                />
              ))
            : null}
          {wide.slice(0, -1).map((source) => (
            <source key={source.type} type={source.type} srcSet={source.srcSet} sizes={sizesHint} />
          ))}
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized AVIF/WebP with its own srcset and a phone version */}
          <img
            src={fallback.src}
            srcSet={fallback.srcSet}
            sizes={sizesHint}
            alt={alt ?? draftAlt(slot.alt, itemName)}
            width={slot.size[0]}
            height={slot.size[1]}
            decoding="async"
            {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
            className="size-full object-cover"
          />
        </picture>
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
