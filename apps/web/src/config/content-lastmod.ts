import { execFileSync } from "node:child_process";

/**
 * The real "last modified" date of the repo-authored page copy (ADR-028), for the sitemap's
 * `<lastmod>` on the homepage and the top-level pages (finding C7). Resolved once, at build time,
 * in `next.config.ts`, and inlined as `VITALOS_CONTENT_LASTMOD`.
 *
 * Source: the committer date of the newest commit that touched the page copy. Vercel clones
 * with a shallow history, so that commit may be missing; then the oldest commit in the clone is
 * the best bound we can prove (the copy last changed at or before it). Without git at all, the
 * date is left out: no `<lastmod>` is better than an invented one, and a build time would claim
 * a change on every deploy.
 */
// `:(top)` makes each pathspec relative to the repository root, whatever the working directory
// (`next build` runs in apps/web).
export const CONTENT_PATHS = [
  ":(top)packages/cms/src/draft/content",
  ":(top)packages/cms/src/repo",
  ":(top)packages/cms/src/locked-copy.ts",
] as const;

export type GitRunner = (args: readonly string[]) => string;

const isoDate = (value: string): string | undefined => {
  const trimmed = value.trim().split("\n")[0]?.trim() ?? "";
  const time = Date.parse(trimmed);
  return trimmed !== "" && !Number.isNaN(time) ? new Date(time).toISOString() : undefined;
};

export function resolveContentLastModified(git: GitRunner): string | undefined {
  try {
    const touched = isoDate(git(["log", "-1", "--format=%cI", "--", ...CONTENT_PATHS]));
    if (touched) return touched;
    // Shallow clone without the commit: the clone's oldest commit bounds the change.
    const shallow = git(["rev-parse", "--is-shallow-repository"]).trim() === "true";
    if (!shallow) return undefined;
    const oldest = git(["log", "--reverse", "--format=%cI"]);
    return isoDate(oldest);
  } catch {
    return undefined;
  }
}

/** Runs git from `cwd` with a short timeout and no output on stderr. */
export const gitIn =
  (cwd: string): GitRunner =>
  (args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
