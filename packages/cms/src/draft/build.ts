/**
 * Builders for draft content: Portable Text blocks, SEO and calls to action. Pure data helpers;
 * the words come from the content modules, never from here.
 */
import { hrefForRoutePage } from "../routes";
import type { ContactIntent, RoutePageKey } from "../routes";
import type { CtaIntent, CtaView, RichText, RichTextBlock, SeoView } from "../content/types";

type Node =
  | { kind: "p" | "h2" | "h3"; text: string }
  | { kind: "ul" | "ol"; items: readonly string[] }
  | { kind: "link"; before: string; text: string; href: string; after: string };

/** A paragraph. */
export const p = (text: string): Node => ({ kind: "p", text });
/** A section heading inside a body (h2). */
export const h2 = (text: string): Node => ({ kind: "h2", text });
/** A sub-heading inside a body (h3). */
export const h3 = (text: string): Node => ({ kind: "h3", text });
/**
 * A paragraph with one internal link (same-site path from routes.ts), in the resolved form the
 * content sources serve.
 */
export const pLink = (before: string, text: string, href: string, after = ""): Node => ({
  kind: "link",
  before,
  text,
  href,
  after,
});
/** A bulleted list. */
export const ul = (...items: string[]): Node => ({ kind: "ul", items });
/** A numbered list. */
export const ol = (...items: string[]): Node => ({ kind: "ol", items });

function block(key: string, text: string, extra: Record<string, unknown>): RichTextBlock {
  return {
    _type: "block",
    _key: key,
    style: "normal",
    ...extra,
    children: [{ _type: "span", _key: `${key}-s`, text, marks: [] }],
    markDefs: [],
  };
}

/** Portable Text from nodes. Keys are `${prefix}-${n}` so they are stable across builds. */
export function richText(prefix: string, ...nodes: readonly Node[]): RichText {
  const blocks: RichTextBlock[] = [];
  const next = () => `${prefix}-${blocks.length + 1}`;
  for (const node of nodes) {
    switch (node.kind) {
      case "p":
        blocks.push(block(next(), node.text, {}));
        break;
      case "h2":
      case "h3":
        blocks.push(block(next(), node.text, { style: node.kind }));
        break;
      case "link": {
        const key = next();
        const linkKey = `${key}-l`;
        const span = (suffix: string, text: string, marks: string[]) => ({
          _type: "span",
          _key: `${key}-${suffix}`,
          text,
          marks,
        });
        blocks.push({
          _type: "block",
          _key: key,
          style: "normal",
          children: [
            ...(node.before ? [span("s1", node.before, [])] : []),
            span("s2", node.text, [linkKey]),
            ...(node.after ? [span("s3", node.after, [])] : []),
          ],
          markDefs: [{ _type: "link", _key: linkKey, href: node.href, internal: true }],
        });
        break;
      }
      case "ul":
      case "ol":
        for (const item of node.items) {
          blocks.push(
            block(next(), item, { listItem: node.kind === "ul" ? "bullet" : "number", level: 1 }),
          );
        }
        break;
    }
  }
  return blocks;
}

/** Meta title and description. Lengths (60 and 160) are checked by the draft tests. */
export const seo = (title: string, description: string): SeoView => ({ title, description });

/** A call to action to a route page (the contact page by default). */
export function cta(
  label: string,
  intent: ContactIntent | Extract<CtaIntent, "explore">,
  key: RoutePageKey = "contact",
): CtaView {
  return { label, href: hrefForRoutePage(key), intent };
}
