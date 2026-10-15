import type { ReactNode } from "react";
import type { RichText as RichTextValue } from "@vitalos/cms";
import type { PatternLink } from "@vitalos/ui";
import { PageMain } from "../../components/site-chrome/PageMain";
import type { Crumb } from "../../lib/view-mapping/breadcrumbs";
import { ClosingBand, PageIntro, renderBands } from "./bands";
import type { BandFactory } from "./bands";
import { bodyBands } from "./body-bands";

export interface IndexLayoutProps {
  crumbs: readonly Crumb[];
  /** The page's h1: the route page heading from the CMS, or the locked/structural label. */
  title: string;
  /** Route page introduction (CMS). */
  lead?: string | undefined;
  /** Route page body (CMS rich text). */
  body?: RichTextValue | undefined;
  /** Hero actions, usually one link. */
  actions?: ReactNode;
  /** Bands for each list on the page. A factory returns null when its list is empty. */
  bands: readonly BandFactory[];
  /** The closing card's own action; defaults to Talk to Vitalos. */
  closing?: PatternLink | undefined;
  /** Extra content after the bands, before the closing card. */
  children?: ReactNode;
}

/**
 * Shared frame of the commercial index pages, in the homepage's design (pages redesign, 15 Oct
 * 2026): one `<main>`, the full dark hero (h1, lead), the route page's own body as bands, the
 * bands that have content, and the closing card.
 */
export function IndexLayout({
  crumbs,
  title,
  lead,
  body,
  actions,
  bands,
  closing,
  children,
}: Readonly<IndexLayoutProps>) {
  return (
    <PageMain>
      <PageIntro crumbs={crumbs} title={title} {...(lead ? { lead } : {})} actions={actions} />
      {renderBands([...bodyBands(body), ...bands], "light")}
      {children}
      <ClosingBand primary={closing} />
    </PageMain>
  );
}
