import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brandName } from "@vitalos/cms";
import { getEnv } from "@vitalos/config";
import { loadChromeContent } from "../../../../src/components/site-chrome/load";
import { loadRolePage } from "../../../../src/features/content/careers/load";
import { jobPostingJsonLd, rolePathOf } from "../../../../src/features/content/careers/model";
import { isSlug } from "../../../../src/features/content/readers";
import { CAREERS_BASE } from "../../../../src/features/content/routes";
import { getSeoContext } from "../../../../src/features/seo/context";
import { breadcrumbJsonLd, organizationJsonLd } from "../../../../src/features/seo/json-ld";
import { RoleTemplate } from "../../../../src/templates/careers/RoleTemplate";
import { careersMetadata } from "../../../../src/templates/careers/metadata";

type Params = { slug: string };

/** Roles are generated on first request, then served from ISR and refreshed by their tags. */
export const dynamicParams = true;
export const generateStaticParams = (): Params[] => [];

async function slugOf(params: Promise<Params>): Promise<string> {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  return slug;
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const view = await loadRolePage(await slugOf(params));
  return careersMetadata({
    path: rolePathOf(view.role.slug),
    title: view.role.title,
    description: view.kind === "open" ? view.role.summary : undefined,
    // A closed role keeps its page but is not indexed (brief 6.2).
    noindex: view.kind === "closed",
  });
}

export default async function RoleRoute({ params }: Readonly<{ params: Promise<Params> }>) {
  const view = await loadRolePage(await slugOf(params));
  const ctx = { siteUrl: getSeoContext().siteUrl };
  let jsonLd: (Record<string, unknown> | null)[] = [];
  if (view.kind === "open" && !view.previewStatus) {
    const { settings } = await loadChromeContent();
    const organization = organizationJsonLd(settings, ctx);
    jsonLd = [
      jobPostingJsonLd(view.role, {
        siteUrl: ctx.siteUrl,
        descriptionHtml: view.descriptionHtml,
        organization: {
          name: brandName,
          url: String(organization["url"] ?? ctx.siteUrl),
          ...(organization["logo"] ? { logo: organization["logo"] } : {}),
        },
      }),
      breadcrumbJsonLd(
        [
          { name: brandName, path: "/" },
          { name: "Careers", path: CAREERS_BASE },
          { name: view.role.title, path: rolePathOf(view.role.slug) },
        ],
        ctx,
      ),
    ];
  }
  return <RoleTemplate view={view} jsonLd={jsonLd} turnstileSiteKey={getEnv().turnstile.siteKey} />;
}
