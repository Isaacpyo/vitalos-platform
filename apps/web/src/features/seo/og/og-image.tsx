import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { wordmarkText } from "@vitalos/cms";
import { colors } from "@vitalos/design-tokens";

/**
 * The one Open Graph and Twitter image template (docs/seo/DECISIONS.md 21), 1200×630: midnight
 * ground, the title in Manrope with its full stop in Vitalos Blue (cobalt), the Vitalos symbol
 * unchanged, and a mono eyebrow. Every `opengraph-image.tsx` renders through it. Images are built
 * at build time from content that is already public, so nothing here reads request data.
 *
 * Fonts are static Latin subsets of the OFL fonts the site already ships (Manrope 800 and
 * JetBrains Mono 500, instanced from the Relay variable files): the image renderer reads TTF but
 * not WOFF2. The symbol is the approved asset resized to 512 px (public/brand/vitalos-symbol-512.png).
 */
export const ogSize = { width: 1200, height: 630 } as const;
export const ogContentType = "image/png";

// Literal paths from the app root (the Next.js pattern), so the bundler traces exactly these files.
const assets = Promise.all([
  readFile(join(process.cwd(), "src/features/seo/og/assets/manrope-800.ttf")),
  readFile(join(process.cwd(), "src/features/seo/og/assets/jetbrains-mono-500.ttf")),
  readFile(join(process.cwd(), "public/brand/vitalos-symbol-512.png"), "base64"),
]);

export interface OgImageInput {
  /** Small mono line above the title, for example the template ("Practice") or category. */
  eyebrow: string;
  /** The page's h1 or name. */
  title: string;
}

/** The title with exactly one full stop, which is drawn in Vitalos Blue. */
function splitTitle(title: string): { text: string; stop: string } {
  const trimmed = title.trim().replace(/\.+$/, "");
  return { text: trimmed, stop: /[?!]$/.test(trimmed) ? "" : "." };
}

const titleSize = (title: string) =>
  title.length > 60 ? 56 : title.length > 36 ? 64 : title.length > 22 ? 76 : 84;

export async function renderOgImage({ eyebrow, title }: OgImageInput): Promise<ImageResponse> {
  const [manrope, mono, symbol] = await assets;
  const { text, stop } = splitTitle(title);
  // The image renderer lays out every element as a flex item, so each word is its own item and
  // the full stop stays attached to the last word instead of floating at the end of the line.
  const words = text.split(/\s+/);
  const last = words.pop() ?? "";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: colors.midnight950,
        color: colors.white,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain img */}
        <img src={`data:image/png;base64,${symbol}`} width={72} height={72} alt="" />
        <div
          style={{
            display: "flex",
            fontFamily: "Manrope",
            fontSize: 34,
            letterSpacing: 6,
          }}
        >
          {wordmarkText}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            fontFamily: "JetBrains Mono",
            fontSize: eyebrow.length > 40 ? 22 : 26,
            letterSpacing: eyebrow.length > 40 ? 3 : 4,
            color: colors.border,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontFamily: "Manrope",
            fontSize: titleSize(text),
            lineHeight: 1.08,
            letterSpacing: -1,
            maxWidth: 1040,
            columnGap: Math.round(titleSize(text) * 0.26),
          }}
        >
          {words.map((word, index) => (
            <span key={index}>{word}</span>
          ))}
          <span style={{ display: "flex" }}>
            <span>{last}</span>
            <span style={{ color: colors.blue600 }}>{stop}</span>
          </span>
        </div>
      </div>
    </div>,
    {
      ...ogSize,
      fonts: [
        { name: "Manrope", data: manrope, weight: 800, style: "normal" },
        { name: "JetBrains Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
