import type { ReactNode } from "react";

/**
 * Safe markdown subset for AI and team messages (section 4.6): paragraphs, **bold**, short lists
 * and links to vitalos.co.uk or same-site paths. Never renders raw HTML: everything is React text.
 * `[n]` citation markers become small superscript links to the source rows.
 */
const SAFE_LINK = /^(\/(?!\/)[^\s]*|https:\/\/(www\.)?vitalos\.co\.uk(\/[^\s]*)?)$/;

function inline(
  text: string,
  keyPrefix: string,
  sourceAnchor?: (n: number) => string | null,
): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]{1,80})\]\(([^)\s]{1,300})\)|\[(\d)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1] !== undefined) {
      out.push(<strong key={key}>{m[1]}</strong>);
    } else if (m[2] !== undefined && m[3] !== undefined) {
      out.push(
        SAFE_LINK.test(m[3]) ? (
          <a key={key} href={m[3]} className="relay-link">
            {m[2]}
          </a>
        ) : (
          m[2]
        ),
      );
    } else if (m[4] !== undefined) {
      const n = Number(m[4]);
      const href = sourceAnchor?.(n);
      if (href) {
        out.push(
          <sup key={key} className="relay-cite">
            <a href={href} aria-label={`Source ${n}`}>
              {n}
            </a>
          </sup>,
        );
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({
  text,
  sourceAnchor,
}: {
  text: string;
  sourceAnchor?: (n: number) => string | null;
}) {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <>
      {blocks.map((block, b) => {
        const lines = block.split("\n");
        const bullet = lines.every((l) => /^[-*] /.test(l));
        const numbered = lines.every((l) => /^\d+\. /.test(l));
        if (bullet || numbered) {
          const items = lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^([-*]|\d+\.) /, ""), `b${b}-${j}`, sourceAnchor)}</li>
          ));
          return numbered ? <ol key={b}>{items}</ol> : <ul key={b}>{items}</ul>;
        }
        return <p key={b}>{inline(lines.join(" "), `p${b}`, sourceAnchor)}</p>;
      })}
    </>
  );
}
