/**
 * Redirect rules (Stage 10 §11 "Redirect rules"; Stage 8 §7 "URL durability").
 *
 * Sync rules check one redirect on its own. Async rules (`redirectLookupIssues`) consult the other
 * redirects through an injected `RedirectLookup`, so they run in Studio (via the Sanity client) and
 * in tests (via an in-memory list).
 */
import { routeManifest } from "../../routes";
import { redirectStatusCodes } from "../constants";
import { hasText, isHttpsUrl, isRecord, issue, str, type Issue } from "./issue";

export interface RedirectRecord {
  _id: string;
  source: string;
  status: number;
  destination?: string;
}

/** Looks up redirects other than the one being validated. */
export interface RedirectLookup {
  others(excludeIds: readonly string[]): Promise<readonly RedirectRecord[]>;
}

/** `drafts.abc` and `abc` are the same redirect. */
export function idPair(id: string): [published: string, draft: string] {
  const published = id.replace(/^drafts\./, "");
  return [published, `drafts.${published}`];
}

/** Internal path rules: absolute path, not protocol-relative, no query/fragment/whitespace/trailing slash. */
export function internalPathIssues(value: string, field: "source" | "destination"): Issue[] {
  const issues: Issue[] = [];
  if (!value.startsWith("/")) {
    issues.push(issue("Must start with '/'.", field));
    return issues;
  }
  if (value.startsWith("//")) {
    issues.push(issue("Must not start with '//' (that is a protocol-relative URL).", field));
  }
  if (/[?#\s]/.test(value)) {
    issues.push(issue("Must be a plain path: no query string, fragment or spaces.", field));
  }
  if (value.length > 1 && value.endsWith("/")) {
    issues.push(issue("Remove the trailing slash.", field));
  }
  if (value.includes("..")) {
    issues.push(issue("Must not contain '..'.", field));
  }
  return issues;
}

const staticRoutes: ReadonlySet<string> = new Set(
  routeManifest.filter((entry) => !entry.pattern.includes("[")).map((entry) => entry.pattern),
);

/** Redirect sources are legacy or retired paths; they must never shadow a live page or an API route. */
export function shadowsLiveRoute(source: string): boolean {
  return staticRoutes.has(source) || source === "/api" || source.startsWith("/api/");
}

export function redirectIssues(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  const issues: Issue[] = [];
  const source = str(doc, "source");
  const destination = str(doc, "destination");
  const status = doc["status"];

  if (!hasText(source)) {
    issues.push(issue("A redirect needs a source path.", "source"));
  } else {
    issues.push(...internalPathIssues(source, "source"));
    if (shadowsLiveRoute(source)) {
      issues.push(
        issue(
          "This source is a live page or API route; redirecting it would hide the page.",
          "source",
        ),
      );
    }
  }

  if (typeof status !== "number" || !(redirectStatusCodes as readonly number[]).includes(status)) {
    issues.push(issue("Status must be 301, 308 or 410.", "status"));
    return issues;
  }

  if (status === 410) {
    if (hasText(destination)) {
      issues.push(issue("A 410 (gone) has no destination. Clear it.", "destination"));
    }
    return issues;
  }

  if (!hasText(destination)) {
    issues.push(issue("A redirect needs a destination.", "destination"));
  } else if (destination.startsWith("/")) {
    issues.push(...internalPathIssues(destination, "destination"));
    if (hasText(source) && destination === source) {
      issues.push(
        issue("The destination cannot be the same as the source (redirect loop).", "destination"),
      );
    }
  } else if (!isHttpsUrl(destination)) {
    issues.push(issue("The destination must be an internal path or an https URL.", "destination"));
  }
  return issues;
}

/**
 * Uniqueness and chain rejection against the other redirects.
 *
 * Chains: A -> B plus B -> C must be flattened to A -> C and B -> C, so a redirect is rejected when
 * its destination is another redirect's source, or when its source is another redirect's destination.
 * A redirect pointing at a 410 is likewise rejected (visitors would land on a dead end).
 */
export async function redirectLookupIssues(
  doc: unknown,
  id: string,
  lookup: RedirectLookup,
): Promise<Issue[]> {
  if (!isRecord(doc)) return [];
  const source = str(doc, "source");
  if (!hasText(source)) return [];
  const destination = str(doc, "destination");
  const internalDestination =
    destination !== undefined && destination.startsWith("/") ? destination : undefined;

  const others = await lookup.others(idPair(id));
  const issues: Issue[] = [];

  if (others.some((other) => other.source === source)) {
    issues.push(issue("Another redirect already uses this source path.", "source"));
  }
  if (internalDestination !== undefined) {
    const next = others.find((other) => other.source === internalDestination);
    if (next) {
      issues.push(
        issue(
          next.status === 410
            ? `The destination ${internalDestination} is a 410 (gone); redirecting to it leaves visitors at a dead end.`
            : `Redirect chain: ${internalDestination} is itself redirected. Point this redirect at ${next.destination ?? "the final destination"} instead.`,
          "destination",
        ),
      );
    }
  }
  const previous = others.filter((other) => other.destination === source);
  if (previous.length > 0) {
    issues.push(
      issue(
        `Redirect chain: ${previous.map((other) => other.source).join(", ")} already redirects to ${source}. Update that redirect to point at the final destination first.`,
        "source",
      ),
    );
  }
  return issues;
}
