import "server-only";
import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { pageGraph } from "../../templates/commercial/seo";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import type { Crumb } from "../../lib/view-mapping/breadcrumbs";
import { buildMetadata } from "../seo/metadata";
import type { JsonLdNode } from "../seo/json-ld";

/**
 * Titles, descriptions and structured data for the AI & Data pages, through the site's one
 * metadata module (ADR-043). Titles stay within 60 characters with the "| Vitalos" template and
 * descriptions within 120 to 155 (asserted in seo.test.ts).
 */

export type AiDataPageKey = "home" | "solutions" | "approach" | "demonstrator" | "contact";

interface PageSeo {
  path: string;
  /** Breadcrumb label. */
  crumb: string;
  title: string;
  description: string;
}

export const aiDataSeo: Record<AiDataPageKey, PageSeo> = {
  home: {
    path: routes.aiData.home(),
    crumb: "AI & Data",
    title: "AI & Data: Applied AI and Data Engineering",
    description:
      "Vitalos AI & Data designs, builds and operates practical AI and data systems for UK businesses, from a scoped assessment to a monitored live system.",
  },
  solutions: {
    path: routes.aiData.solutions(),
    crumb: "Solutions",
    title: "AI & Data Solutions for UK Businesses",
    description:
      "Document processing, statement reconciliation, enquiry follow-up, reporting and quoting: what we build, and where people stay in control.",
  },
  approach: {
    path: routes.aiData.approach(),
    crumb: "Our Approach",
    title: "Our Approach to AI Engineering",
    description:
      "How Vitalos AI & Data works: from understanding the problem and measuring a baseline to evaluation, deployment, operation and careful data handling.",
  },
  demonstrator: {
    path: routes.aiData.demonstrator(),
    crumb: "Demonstrator",
    title: "Supplier Statement Reconciliation Demonstrator",
    description:
      "A demonstrator on synthetic data that reconciles supplier statements against a purchase ledger, routes exceptions to a reviewer and is evaluated offline.",
  },
  contact: {
    path: routes.aiData.contact(),
    crumb: "Contact",
    title: "Discuss Your Business Challenge",
    description:
      "Tell Vitalos AI & Data about the workflow you want to improve. We read every enquiry and reply to arrange a conversation about the right first step.",
  },
};

const crumbsFor = (key: AiDataPageKey): Crumb[] => {
  const home = { label: aiDataSeo.home.crumb, path: aiDataSeo.home.path };
  return key === "home"
    ? trail(home)
    : trail(home, { label: aiDataSeo[key].crumb, path: aiDataSeo[key].path });
};

export function aiDataMetadata(key: AiDataPageKey): Metadata {
  const page = aiDataSeo[key];
  return buildMetadata({ path: page.path, title: page.title, description: page.description });
}

/** WebPage and BreadcrumbList for a page; the home page also describes the Service. */
export function aiDataGraph(key: AiDataPageKey, name: string, description: string): JsonLdNode {
  return pageGraph({
    trail: crumbsFor(key),
    name,
    description,
    ...(key === "home" ? { serviceType: "Applied AI and data engineering" } : {}),
    ...(key === "contact" ? { type: "ContactPage" as const } : {}),
  });
}
