/**
 * Draft redirect for a changed public URL (Stage 10 §9; Stage 8 §7 "URL durability").
 *
 * The redirect is created as a DRAFT in `review` status: an editor approves and publishes it, and
 * the redirect validators reject chains and duplicates at that point.
 */
import type { SlugChange } from "../schemaTypes/document-href";
import { defaultLocale } from "../schemaTypes/constants";
import { hyphenate, obj, str, todayIso } from "../schemaTypes/rules/issue";

/** Deterministic, so repeated publishes never create duplicate drafts. */
export function redirectDraftId(from: string): string {
  const slug = hyphenate(from);
  return `drafts.redirect-${slug || "root"}`;
}

export interface RedirectDraft {
  _id: string;
  _type: "redirect";
  source: string;
  status: 301;
  destination: string;
  reason: string;
  governance: {
    _type: "governance";
    owner: string;
    editorialStatus: "review";
    reviewDate: string;
  };
  locale: string;
}

export function buildRedirectDraft(
  change: SlugChange,
  source: { _type?: string; title?: string; name?: string; governance?: unknown },
  today: string = todayIso(),
): RedirectDraft {
  const governance = obj(source, "governance");
  const label = source.title ?? source.name ?? source._type ?? "document";
  return {
    _id: redirectDraftId(change.from),
    _type: "redirect",
    source: change.from,
    status: 301,
    destination: change.to,
    reason: `URL changed for "${label}"`.slice(0, 200),
    governance: {
      _type: "governance",
      owner: str(governance, "owner") ?? "Unassigned",
      editorialStatus: "review",
      reviewDate: str(governance, "reviewDate") ?? today,
    },
    locale: defaultLocale,
  };
}
