import type { ContentSourceKind } from "@vitalos/config";
import { Container } from "@vitalos/ui";

/** The ribbon's visible notice. Structural wording fixed by ADR-025 (handoff §7), not marketing copy. */
export const draftRibbonText = {
  label: "Draft content notice",
  title: "Draft content, pending approval.",
  detail:
    "The content on this site is drafted from Vitalos strategy documents for review. It is not approved for publication.",
} as const;

/**
 * The compact navigation sheet is sized to the viewport below the sticky header. At the top of the
 * page the ribbon sits above the header and would push the sheet's foot off screen, so the ribbon
 * steps aside while that sheet is open: `[data-mobile-nav-sheet]` only, never the per-section
 * disclosures inside it, which may stay open after the sheet closes. CSS only; it is shown again
 * as soon as the menu closes, and it is never hidden otherwise.
 */
export const HIDE_WHILE_MENU_OPEN = "[body:has([data-mobile-nav-sheet][open])_&]:hidden";

/** Whether the site is serving the repo-authored draft content set (ADR-025). */
export const showsDraftRibbon = (kind: ContentSourceKind): boolean => kind === "draft";

/**
 * A full-width notice shown on every page while `VITALOS_CONTENT_SOURCE=draft`. Server-rendered,
 * in the page flow (never fixed, so it cannot cover focused content), readable without
 * JavaScript, and styled with design tokens only. Renders nothing for any other source.
 */
export function DraftContentRibbon({ kind }: Readonly<{ kind: ContentSourceKind }>) {
  if (!showsDraftRibbon(kind)) return null;
  return (
    <aside
      aria-label={draftRibbonText.label}
      data-tone="dark"
      data-draft-ribbon=""
      className={`bg-tone-bg text-tone-text ${HIDE_WHILE_MENU_OPEN}`}
    >
      <Container size="wide" className="py-(--space-3)">
        <p className="m-0 text-small">
          <strong>{draftRibbonText.title}</strong> {draftRibbonText.detail}
        </p>
      </Container>
    </aside>
  );
}
