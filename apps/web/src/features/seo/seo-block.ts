import { z } from "zod";
import type { SeoView } from "@vitalos/cms";

/**
 * The optional `seo` block every content source may give a document (title, description,
 * ogImage, noindex), validated field by field. A field that fails is dropped, so the page falls
 * back to the document's own title or summary, then to the site defaults, instead of failing
 * or rendering a broken tag. Length targets are checked by tests and `pnpm seo:check`, not here:
 * a long title is still better than none.
 */
const text = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((value) => !/[<>]/.test(value), "no markup");

const fields = {
  title: text,
  description: text,
  noindex: z.boolean(),
  ogImage: z
    .object({
      url: z.string().min(1),
      alt: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      decorative: z.boolean().optional(),
    })
    .loose(),
} as const;

export const seoBlockSchema = z.object(fields).partial();

export function sanitiseSeo(seo: SeoView | undefined): SeoView | undefined {
  if (!seo || typeof seo !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    const value = (seo as Record<string, unknown>)[key];
    if (value === undefined) continue;
    const parsed = fields[key].safeParse(value);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as SeoView;
}
