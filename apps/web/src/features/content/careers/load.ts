import "server-only";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { renderMarkdown } from "../markdown/render";
import { getPreviewData, isDraftModeRequest } from "../preview";
import type { ReadResult } from "../readers";
import type { CareersPageData, SiteStateData } from "../schemas";
import { getContentReaders } from "../server";
import { isBuildPhase, requireCareersOpen } from "../site-state";
import { siteHosts } from "../site-hosts";
import { roleSections, rolePathOf } from "./model";
import type { ClosedRole, RoleDetail } from "./model";

/**
 * Loaders for the Careers pages (ADR-040), the same way as Insights: cached, tagged reads; closed
 * or unconfigured is `notFound()`; a failed read throws at runtime and reads as 404 during
 * `next build`; Draft Mode reads the working copy. Markdown is rendered while the page is
 * generated (ISR keeps the HTML).
 */

async function read<T>(load: () => Promise<ReadResult<T>>): Promise<T> {
  let result: ReadResult<T>;
  try {
    result = await load();
  } catch (error) {
    if (isBuildPhase()) notFound();
    throw error;
  }
  if (result.kind === "missing") notFound();
  return result.data;
}

const renderSettings = async (markdown: string): Promise<string> =>
  markdown.trim()
    ? (await renderMarkdown(markdown, { context: "settings", siteHosts: siteHosts() })).html
    : "";

export interface CareersPageView {
  state: SiteStateData;
  page: CareersPageData;
  /** Rendered optional sections; empty strings are not shown. */
  sections: { benefits: string; process: string; salaryPolicy: string; equalOpportunities: string };
}

export const loadCareersPage = cache(async (): Promise<CareersPageView> => {
  const state = await requireCareersOpen();
  const page = await read(() => getContentReaders().careersPage());
  const [benefits, process, salaryPolicy, equalOpportunities] = await Promise.all([
    renderSettings(page.copy.benefits),
    renderSettings(page.copy.process),
    renderSettings(page.copy.salaryPolicy),
    renderSettings(page.copy.equalOpportunities),
  ]);
  return { state, page, sections: { benefits, process, salaryPolicy, equalOpportunities } };
});

export interface RenderedSection {
  key: string;
  heading: string;
  html: string;
}

export type RolePageView =
  | {
      kind: "open";
      role: RoleDetail;
      sections: RenderedSection[];
      /** The role's text as one HTML document (JobPosting description). */
      descriptionHtml: string;
      previewStatus: string | null;
    }
  | { kind: "closed"; role: ClosedRole };

async function previewRole(slug: string): Promise<{ role: RoleDetail; status: string } | null> {
  if (!(await isDraftModeRequest())) return null;
  const preview = await getPreviewData();
  return preview?.entity === "role" && preview.role && preview.role.slug === slug
    ? { role: preview.role, status: preview.status }
    : null;
}

export const loadRolePage = cache(async (slug: string): Promise<RolePageView> => {
  await requireCareersOpen();
  const preview = await previewRole(slug);
  let role: RoleDetail;
  if (preview) {
    role = preview.role;
  } else {
    const data = await read(() => getContentReaders().role(slug));
    if ("redirect" in data) permanentRedirect(rolePathOf(data.redirect));
    if (data.state === "closed") return { kind: "closed", role: data };
    role = data;
  }
  const rendered = await Promise.all(
    roleSections.map(async (section): Promise<RenderedSection | null> => {
      const markdown = role.sections[section.key];
      if (!markdown.trim()) return null;
      const html = (await renderMarkdown(markdown, { context: "role", siteHosts: siteHosts() }))
        .html;
      return { key: section.key, heading: section.heading, html };
    }),
  );
  const sections = rendered.filter((section): section is RenderedSection => section !== null);
  const descriptionHtml = [
    `<p>${escapeHtml(role.summary)}</p>`,
    ...sections.map((section) => `<h2>${escapeHtml(section.heading)}</h2>${section.html}`),
  ].join("");
  return { kind: "open", role, sections, descriptionHtml, previewStatus: preview?.status ?? null };
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
