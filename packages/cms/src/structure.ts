/**
 * Studio desk structure (`@vitalos/cms/structure`).
 *
 * Grouped by editorial area, with the singletons pinned first and two governance queues:
 * "Needs review" (review date passed) and "Awaiting approval" (status: in review).
 */
import type { StructureResolver } from "sanity/structure";
import {
  documentTypeNames,
  isSingletonType,
  singletonTypes,
  type DocumentTypeName,
  type SingletonType,
} from "./schemaTypes/constants";
import { todayIso } from "./schemaTypes/rules/issue";

export interface DeskGroup {
  id: string;
  title: string;
  types: readonly DocumentTypeName[];
}

/** Every non-singleton document type appears in exactly one group (asserted in tests). */
export const deskGroups: readonly DeskGroup[] = [
  { id: "commercial", title: "Commercial", types: ["practice", "solution", "offer", "industry"] },
  {
    id: "proof",
    title: "Proof and authority",
    types: ["caseStudy", "insight", "person", "labAsset"],
  },
  { id: "trust", title: "Trust and legal", types: ["trustItem", "legalPage"] },
  { id: "careers", title: "Careers", types: ["job"] },
  { id: "pages", title: "Page content", types: ["routePage"] },
  { id: "redirects", title: "Redirects", types: ["redirect"] },
];

export const singletonTitles: Record<SingletonType, string> = {
  homePage: "Homepage",
  siteSettings: "Site settings",
};

/** GROQ filters for the governance queues. `$today` and `$types` are supplied as params. */
export const needsReviewFilter =
  '_type in $types && defined(governance.reviewDate) && governance.reviewDate < $today && governance.editorialStatus != "archived"';
export const awaitingApprovalFilter = '_type in $types && governance.editorialStatus == "review"';

export const deskStructure: StructureResolver = (S) => {
  const types = [...documentTypeNames];

  const singletonItems = singletonTypes.map((type) =>
    S.listItem()
      .id(type)
      .title(singletonTitles[type])
      .schemaType(type)
      .child(S.document().schemaType(type).documentId(type)),
  );

  const groupItems = deskGroups.map((group) =>
    S.listItem()
      .id(group.id)
      .title(group.title)
      .child(
        S.list()
          .id(group.id)
          .title(group.title)
          .items(
            group.types
              .filter((type) => !isSingletonType(type))
              .map((type) => S.documentTypeListItem(type)),
          ),
      ),
  );

  return S.list()
    .id("root")
    .title("Content")
    .items([
      ...singletonItems,
      S.divider(),
      ...groupItems,
      S.divider(),
      S.listItem()
        .id("needs-review")
        .title("Needs review")
        .child(
          S.documentList()
            .id("needs-review")
            .title("Needs review (review date passed)")
            .filter(needsReviewFilter)
            .params({ today: todayIso(), types }),
        ),
      S.listItem()
        .id("awaiting-approval")
        .title("Awaiting approval")
        .child(
          S.documentList()
            .id("awaiting-approval")
            .title("Awaiting approval")
            .filter(awaitingApprovalFilter)
            .params({ types }),
        ),
    ]);
};
