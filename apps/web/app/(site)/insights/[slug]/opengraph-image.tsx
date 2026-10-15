import { ImageResponse } from "next/og";
import { wordmarkText } from "@vitalos/cms";
import { colors } from "@vitalos/design-tokens";
import { loadPublishedPost } from "../../../../src/features/content/insights/load";

/**
 * The article's Open Graph image (brief 5.3) from the brand template: midnight ground, the title
 * with its full stop in Vitalos Blue, the wordmark, and the format and date in mono. It reads
 * through the same cached reader as the page, so it carries the post's tags and updates with it.
 * The site loads no Manrope; next/og's default sans is used (DECISIONS: tokens over the brief).
 */
export const alt = "Vitalos Insights";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Generated on first request, then cached (ISR) with the post's tags. */
export const generateStaticParams = (): { slug: string }[] => [];

export default async function OpenGraphImage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const post = await loadPublishedPost((await params).slug);
  const title = post.title.trimEnd();
  const ends = title.endsWith(".");
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        backgroundColor: colors.midnight950,
        color: colors.white,
      }}
    >
      <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>
        {wordmarkText}
      </div>
      <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>
        <span>
          {ends ? title.slice(0, -1) : title}
          <span style={{ color: colors.blue600 }}>.</span>
        </span>
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "monospace",
          fontSize: 26,
          letterSpacing: 3,
          color: colors.border,
        }}
      >
        {`${post.format.label} · ${post.publishedAt.short}`.toUpperCase()}
      </div>
    </div>,
    size,
  );
}
