import type { RedirectRule } from "./types";

/**
 * Redirect map rules (ADR-018). Pure and dependency-free so `next.config.ts`, the proxy, the
 * pull script's tests and the unit tests all apply the same checks:
 *
 *  - sources are exact same-site paths (no wildcards, regex or `//host`); destinations are
 *    same-site paths or https URLs (as in the Studio's redirect rules), never credentialed;
 *  - sources are unique, never "/", never a live static route or API path (`isLiveRoute`); a
 *    dynamic detail path such as `/insights/old-slug` may be redirected (slug changes);
 *  - no blanket redirect to "/" (a redirect must land on the equivalent page);
 *  - no self-redirects, no chains (a destination is never another rule's source) and no loops;
 *  - 410 rules have no destination, 301/308 rules always do.
 */

export interface RedirectIssue {
  source: string;
  message: string;
}

export interface ValidateOptions {
  /** True when the path is served by the site (for example from the route manifest). */
  isLiveRoute?: (path: string) => boolean;
}

const unsafeChars = /[\u0000-\u001f\u007f\\\s]/;
const patternChars = /[*:()[\]{}+?]/;

const pathOnly = (value: string) => value.split(/[?#]/, 1)[0] ?? value;

function checkSource(source: string): string | undefined {
  if (!source.startsWith("/") || source.startsWith("//"))
    return "source must start with a single /";
  if (source === "/") return "the home page cannot be redirected";
  if (unsafeChars.test(source))
    return "source contains whitespace, control or backslash characters";
  if (patternChars.test(source))
    return "source must be an exact path (no wildcards, regex or query)";
  if (source.includes("#")) return "source must not contain a fragment";
  if (source.endsWith("/")) return "source must not end with a slash";
  return undefined;
}

const isExternal = (destination: string) => destination.startsWith("https://");

function checkDestination(destination: string): string | undefined {
  if (isExternal(destination)) {
    if (unsafeChars.test(destination) || !URL.canParse(destination)) {
      return "destination is not a valid https URL";
    }
    const url = new URL(destination);
    if (url.username || url.password) return "destination must not carry credentials";
    return undefined;
  }
  if (!destination.startsWith("/") || destination.startsWith("//")) {
    return "destination must be a same-site path (single /) or an https URL";
  }
  if (unsafeChars.test(destination))
    return "destination contains whitespace, control or backslash characters";
  if (destination.includes("*")) return "destination must not contain wildcards";
  return undefined;
}

export function validateRedirects(
  rules: readonly RedirectRule[],
  options: ValidateOptions = {},
): RedirectIssue[] {
  const issues: RedirectIssue[] = [];
  const add = (source: string, message: string) => issues.push({ source, message });

  const bySource = new Map<string, RedirectRule>();
  for (const rule of rules) {
    if (bySource.has(rule.source)) add(rule.source, "duplicate source");
    else bySource.set(rule.source, rule);
  }

  for (const rule of rules) {
    const sourceIssue = checkSource(rule.source);
    if (sourceIssue) add(rule.source, sourceIssue);
    else if (options.isLiveRoute?.(rule.source)) {
      add(rule.source, "source is a live route; redirecting it would take the page offline");
    }

    if (rule.status === 410) {
      if ((rule as { destination?: unknown }).destination !== undefined) {
        add(rule.source, "a 410 rule must not have a destination");
      }
      continue;
    }

    // Runtime guard: generated or hand-edited data may not match the type.
    const destination: unknown = rule.destination;
    if (typeof destination !== "string") {
      add(rule.source, "a redirect rule needs a destination");
      continue;
    }
    const destinationIssue = checkDestination(destination);
    if (destinationIssue) {
      add(rule.source, destinationIssue);
      continue;
    }

    // An external destination leaves the site: no blanket, self or chain checks apply.
    if (isExternal(destination)) continue;

    const destinationPath = pathOnly(destination);
    if (destinationPath === "/") add(rule.source, "blanket redirect to / is not allowed");
    if (destinationPath === rule.source) add(rule.source, "redirects to itself");
    const next = bySource.get(destinationPath);
    if (next && destinationPath !== rule.source) {
      add(
        rule.source,
        next.status === 410
          ? `destination ${destinationPath} is a gone (410) path`
          : `redirect chain: destination ${destinationPath} is itself redirected`,
      );
    }
  }

  // Loops longer than two hops (A -> B -> C -> A) are also chains, but name them for clarity.
  for (const start of bySource.keys()) {
    const seen = new Set<string>([start]);
    let current = bySource.get(start);
    while (
      current &&
      current.status !== 410 &&
      typeof current.destination === "string" &&
      !isExternal(current.destination)
    ) {
      const nextPath = pathOnly(current.destination);
      if (seen.has(nextPath)) {
        if (nextPath === start) add(start, "redirect loop");
        break;
      }
      seen.add(nextPath);
      current = bySource.get(nextPath);
    }
  }

  return issues;
}

export function assertValidRedirects(
  rules: readonly RedirectRule[],
  options: ValidateOptions = {},
): void {
  const issues = validateRedirects(rules, options);
  if (issues.length > 0) {
    throw new Error(
      `Invalid redirect map:\n${issues.map((issue) => `- ${issue.source}: ${issue.message}`).join("\n")}`,
    );
  }
}
