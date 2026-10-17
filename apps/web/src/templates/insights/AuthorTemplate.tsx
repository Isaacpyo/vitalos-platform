import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brandName } from "@vitalos/cms";
import { loadAuthorPage } from "../../features/content/insights/load";
import {
  authorHref,
  gridHasCovers,
  isOrganisationAuthor,
} from "../../features/content/insights/model";
import { personNode } from "../../features/seo/graph";
import { getSeoContext } from "../../features/seo/context";
import { isSlug } from "../../features/content/readers";
import { INSIGHTS_BASE } from "../../features/content/routes";
import { Breadcrumbs } from "../institutional/breadcrumbs";
import { ListingTemplate } from "./IndexTemplate";
import { insightsMetadata } from "./metadata";

/** Author pages (brief 5.1): name, role, bio, LinkedIn link and their posts in the grid. */

async function load(slug: string) {
  if (!isSlug(slug)) notFound();
  return loadAuthorPage(slug);
}

export async function authorMetadata(slug: string): Promise<Metadata> {
  const { author } = await load(slug);
  return insightsMetadata({
    path: authorHref(author.author.slug),
    title: author.author.name,
    description: `${author.author.name}, ${author.author.roleTitle}`,
  });
}

export async function renderAuthorPage(slug: string) {
  const { author, bio } = await load(slug);
  const posts = author.posts;
  return (
    <ListingTemplate
      eyebrow={author.author.roleTitle}
      title={author.author.name}
      posts={posts}
      covers={gridHasCovers(posts)}
      crumbs={
        <Breadcrumbs
          trail={[
            { name: brandName, path: "/" },
            { name: "Insights", path: INSIGHTS_BASE },
            { name: author.author.name, path: authorHref(author.author.slug) },
          ]}
          page={{
            type: "ProfilePage",
            // Person on the author page (C11): the name, role and LinkedIn link shown here. An
            // organisation author (the Vitalos team) is the Organization, not a Person.
            ...(isOrganisationAuthor(author.author)
              ? {}
              : {
                  mainEntity: personNode(
                    {
                      name: author.author.name,
                      path: authorHref(author.author.slug),
                      jobTitle: author.author.roleTitle,
                      sameAs: author.author.linkedinUrl ? [author.author.linkedinUrl] : [],
                    },
                    { siteUrl: getSeoContext().siteUrl },
                  ),
                }),
          }}
        />
      }
    >
      {bio.html ? (
        <div
          className="max-w-(--container-prose) text-body-l text-tone-text [&_a]:text-tone-link [&_a]:underline [&_p]:my-(--space-3) [&>p:first-child]:mt-0"
          // Sanitised by the site's one renderer (author context).
          dangerouslySetInnerHTML={{ __html: bio.html }}
        />
      ) : null}
      {author.author.linkedinUrl ? (
        <p className="m-0">
          <a
            href={author.author.linkedinUrl}
            rel="noopener noreferrer"
            className="text-body text-tone-link underline underline-offset-4"
          >
            {author.author.name} on LinkedIn
          </a>
        </p>
      ) : null}
    </ListingTemplate>
  );
}
