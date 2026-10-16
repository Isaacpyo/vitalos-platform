import type { Metadata } from "next";
import { brandName } from "@vitalos/cms";
import type { ImageView, SeoView } from "@vitalos/cms";
import { isSafeRelativeRedirect } from "@vitalos/security/url";
import { isSameOriginImage } from "../../lib/cms/images";
import { getSeoContext } from "./context";
import { sanitiseSeo } from "./seo-block";
import type { SeoContext } from "./context";

export interface PageMetadataInput {
  /** Canonical path of the page from routes.ts (for example `routes.practice(slug)`). Query and fragment are ignored. */
  path: string;
  /** Document title, used when the document's SEO has no title. */
  title?: string | undefined;
  /** Document summary, used when the document's SEO has no description. */
  description?: string | undefined;
  /** The document's SEO object. */
  seo?: SeoView | undefined;
  /** Site-wide fallback (`siteSettings.defaultSeo`). */
  defaultSeo?: SeoView | undefined;
  /** Force noindex, for example a detail page whose publication gate is closed. */
  noindex?: boolean | undefined;
  /** Open Graph type. Default `website`. */
  type?: "website" | "article" | "profile" | undefined;
  /** Only meaningful for `article`; pass real dates and author names or nothing. */
  article?:
    | {
        publishedTime?: string | undefined;
        modifiedTime?: string | undefined;
        authors?: readonly string[] | undefined;
      }
    | undefined;
  /** Home page: use the title as is, without the `| Vitalos` template. */
  absoluteTitle?: boolean | undefined;
}

const usableImage = (image: ImageView | undefined): ImageView | undefined =>
  image && !image.decorative && image.alt.trim() !== "" && isSameOriginImage(image.url)
    ? image
    : undefined;

/**
 * Builds Next.js `Metadata` for a page (pure; the deployment context is explicit).
 *
 * - Title/description: document SEO, then document fields, then site defaults; otherwise they
 *   are left unset and the root layout's defaults (brand name and descriptor) apply.
 * - Canonical is always the absolute URL of `path`; `metadataBase` is set in the root layout.
 * - Open Graph and Twitter repeat the resolved title/description, because a page-level
 *   `openGraph` replaces the layout's entirely. Images only when approved and renderable.
 * - Robots: `noindex, nofollow` when the document says so, when `noindex` is forced, or when the
 *   deployment is not indexable. Otherwise the default (index, follow) is left alone.
 */
export function composeMetadata(input: PageMetadataInput, context: SeoContext): Metadata {
  // Content SEO blocks are validated field by field; an invalid field falls back (seo-block.ts).
  const seo = sanitiseSeo(input.seo);
  const defaultSeo = sanitiseSeo(input.defaultSeo);
  const title = seo?.title ?? input.title ?? defaultSeo?.title;
  const description = seo?.description ?? input.description ?? defaultSeo?.description;
  const ogImage = usableImage(seo?.ogImage ?? defaultSeo?.ogImage);

  // A path such as `//evil.invalid` would resolve to another host: no canonical at all then.
  let url: string | undefined;
  if (isSafeRelativeRedirect(input.path)) {
    const canonical = new URL(input.path, context.siteUrl);
    canonical.search = "";
    canonical.hash = "";
    url = canonical.toString();
  }

  const noindex = Boolean(input.noindex || seo?.noindex) || !context.indexable;
  // A title equal to the brand name would render "Vitalos | Vitalos" through the template.
  const absolute = Boolean(input.absoluteTitle) || title === brandName;
  const socialTitle = title ? (absolute ? title : `${title} | ${brandName}`) : brandName;

  const images = ogImage
    ? [{ url: ogImage.url, width: ogImage.width, height: ogImage.height, alt: ogImage.alt }]
    : undefined;

  const type = input.type ?? "website";
  const article = type === "article" ? input.article : undefined;

  return {
    ...(title ? { title: absolute ? { absolute: title } : title } : {}),
    ...(description ? { description } : {}),
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      type,
      ...(url ? { url } : {}),
      siteName: brandName,
      locale: "en_GB",
      title: socialTitle,
      ...(description ? { description } : {}),
      ...(images ? { images } : {}),
      ...(article?.publishedTime ? { publishedTime: article.publishedTime } : {}),
      ...(article?.modifiedTime ? { modifiedTime: article.modifiedTime } : {}),
      ...(article?.authors?.length ? { authors: [...article.authors] } : {}),
    } as Metadata["openGraph"],
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: socialTitle,
      ...(description ? { description } : {}),
      ...(images ? { images: images.map((image) => image.url) } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * Metadata for a page, for use in `generateMetadata`. Reads the deployment context from the
 * validated server environment unless one is supplied (tests, scripts).
 */
export function buildMetadata(
  input: PageMetadataInput,
  context: SeoContext = getSeoContext(),
): Metadata {
  return composeMetadata(input, context);
}
