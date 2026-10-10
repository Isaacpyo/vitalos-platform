import type { ReactNode } from "react";
import type { RichText as RichTextValue } from "@vitalos/cms";
import { RichText } from "../../components/rich-text";
import { PageMain } from "../../components/site-chrome/PageMain";
import type { Crumb } from "../../lib/view-mapping/breadcrumbs";
import { Band, PageIntro, renderBands } from "./bands";
import type { BandFactory } from "./bands";

export interface IndexLayoutProps {
  crumbs: readonly Crumb[];
  /** The page's h1: the route page heading from the CMS, or the locked/structural label. */
  title: string;
  /** Route page introduction (CMS). */
  lead?: string | undefined;
  /** Route page body (CMS rich text). */
  body?: RichTextValue | undefined;
  /** Bands for each list on the page. A factory returns null when its list is empty. */
  bands: readonly BandFactory[];
  /** Extra content after the bands (for example a closing action). */
  children?: ReactNode;
}

/**
 * Shared frame of the commercial index pages: one `<main>`, an intro band (h1 and lead), the
 * route page's own body, then the bands that have content.
 */
export function IndexLayout({
  crumbs,
  title,
  lead,
  body,
  bands,
  children,
}: Readonly<IndexLayoutProps>) {
  return (
    <PageMain>
      <PageIntro crumbs={crumbs} title={title} {...(lead ? { lead } : {})} />
      {renderBands([
        (tone) =>
          body && body.length > 0 ? (
            <Band tone={tone}>
              <RichText value={body} />
            </Band>
          ) : null,
        ...bands,
      ])}
      {children}
    </PageMain>
  );
}
