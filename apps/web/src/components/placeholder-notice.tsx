import { Container } from "@vitalos/ui";

/**
 * The visible notice on every page that renders placeholder content (ADR-025 status note, owner
 * directive of 11 October 2026). Placeholder documents exist only in the draft content source, which
 * configuration already rejects in production, so this never renders on a production site.
 */
export const placeholderNoticeText = {
  label: "Placeholder content notice",
  title: "Placeholder — replace before launch",
  detail:
    "This page shows invented placeholder content so the section can be reviewed. It is not real and must be replaced or removed before launch.",
} as const;

/** True when any of the given documents or summaries is placeholder content. */
export const hasPlaceholder = (
  ...items: readonly (
    | { placeholder?: true | undefined }
    | readonly { placeholder?: true | undefined }[]
    | null
    | undefined
  )[]
): boolean =>
  items.some((item) =>
    item === null || item === undefined
      ? false
      : Array.isArray(item)
        ? (item as readonly { placeholder?: true | undefined }[]).some(
            (entry) => entry.placeholder === true,
          )
        : (item as { placeholder?: true | undefined }).placeholder === true,
  );

/**
 * A server-rendered notice in the page flow, readable without JavaScript, tokens only. Renders
 * nothing unless `show` is true.
 */
export function PlaceholderNotice({ show }: Readonly<{ show: boolean }>) {
  if (!show) return null;
  return (
    <aside
      aria-label={placeholderNoticeText.label}
      data-tone="dark"
      data-placeholder-notice=""
      className="bg-tone-bg text-tone-text"
    >
      <Container size="wide" className="py-(--space-3)">
        <p className="m-0 text-small">
          <strong>{placeholderNoticeText.title}</strong> {placeholderNoticeText.detail}
        </p>
      </Container>
    </aside>
  );
}
