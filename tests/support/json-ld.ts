import type { Page } from "@playwright/test";

/**
 * The page's JSON-LD nodes: every `<script type="application/ld+json">`, with arrays and
 * `@graph` members flattened (docs/seo/DECISIONS.md 22: one graph per page). Nested nodes, such
 * as the questions inside a FAQPage, stay inside their parent.
 */
export async function jsonLdNodes(page: Page): Promise<Record<string, unknown>[]> {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  return scripts.flatMap((text) => {
    const data: unknown = JSON.parse(text);
    return (Array.isArray(data) ? data : [data]).flatMap((node) => {
      const graph = (node as { "@graph"?: unknown })["@graph"];
      return (Array.isArray(graph) ? graph : [node]) as Record<string, unknown>[];
    });
  });
}

/** Every `@type` on the page's top-level nodes; a multi-typed node contributes each type. */
export async function jsonLdTypes(page: Page): Promise<string[]> {
  return (await jsonLdNodes(page)).flatMap((node) => [node["@type"]].flat() as string[]);
}

/** The first node of a type (multi-typed nodes count for each of their types), or undefined. */
export async function jsonLdNode(
  page: Page,
  type: string,
): Promise<Record<string, unknown> | undefined> {
  return (await jsonLdNodes(page)).find((node) => [node["@type"]].flat().includes(type));
}
