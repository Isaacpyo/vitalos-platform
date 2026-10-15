/**
 * An approved illustration or photograph beside a page hero's copy (pages redesign, 15 Oct 2026):
 * the same files the homepage showcases use, pre-sized WebP from apps/web/public, so it skips the
 * image optimiser. Decorative: the page title says what it shows.
 */
export function HeroImage({
  image,
  fit = "cover",
}: Readonly<{
  image: { src: string; srcSet?: string | undefined; width: number; height: number };
  /** cover: photographs and wide illustrations; contain: square icons on a soft field. */
  fit?: "cover" | "contain";
}>) {
  return (
    <span
      className={`relative block overflow-hidden rounded-2xl ring-1 ring-white/15 ${fit === "contain" ? "aspect-square bg-white/5 p-(--space-6)" : "aspect-[4/3] bg-white/5"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP with its own srcset */}
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes="(min-width: 1024px) 40vw, 100vw"
        width={image.width}
        height={image.height}
        alt=""
        fetchPriority="high"
        decoding="async"
        className={`size-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
      />
    </span>
  );
}
