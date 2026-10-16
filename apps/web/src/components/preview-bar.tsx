import { getPreviewData, getPreviewSession } from "../features/content/preview";
import { postPath, rolePath } from "../features/content/routes";

/** Upper-case status label for the bar, e.g. `in_review` → `IN REVIEW`. */
export const previewStatusLabel = (status: string): string =>
  status.replace(/[_-]+/g, " ").trim().toUpperCase();

/** The exit link: leaves Draft Mode and returns to the item's (public) path. */
export const exitPreviewHref = (path: string): string =>
  `/api/content/preview/exit?path=${encodeURIComponent(path)}`;

/**
 * The fixed midnight bar shown on every page in Draft Mode (brief 3.6): mono
 * "PREVIEW · NOT PUBLISHED · {STATUS}" and an "Exit preview" link. Server-rendered, tokens only.
 */
export function PreviewBarView({
  status,
  exitHref,
}: Readonly<{ status: string | null; exitHref: string }>) {
  const label = ["PREVIEW", "NOT PUBLISHED", ...(status ? [previewStatusLabel(status)] : [])].join(
    " · ",
  );
  return (
    <aside
      aria-label="Preview"
      data-tone="dark"
      data-preview-bar=""
      className="fixed inset-x-0 bottom-0 z-50 border-t border-tone-border bg-tone-bg text-tone-text"
    >
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-(--space-3) px-(--space-4) py-(--space-3)">
        <p className="m-0 font-mono text-eyebrow tracking-widest">{label}</p>
        <a
          href={exitHref}
          className="font-mono text-eyebrow tracking-widest text-tone-link underline underline-offset-4 hover:text-tone-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus"
        >
          Exit preview
        </a>
      </div>
    </aside>
  );
}

/**
 * Rendered by the site layout. Outside Draft Mode (and during static rendering) it reads only
 * `draftMode()` and renders nothing.
 */
export async function PreviewBar() {
  const session = await getPreviewSession();
  if (!session) return null;
  const data = await getPreviewData();
  const slug = data?.post?.slug ?? data?.role?.slug;
  const path = slug ? (data?.entity === "role" ? rolePath(slug) : postPath(slug)) : "/";
  return <PreviewBarView status={data?.status ?? null} exitHref={exitPreviewHref(path)} />;
}
