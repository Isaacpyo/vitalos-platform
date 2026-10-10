import type { PersonView } from "@vitalos/cms";
import type { PatternLink, PersonHeroProps } from "@vitalos/ui";
import { hostLabel, isHttpsUrl } from "../institutional/format";
import { toPatternImage } from "../institutional/images";

/** Person view model to pattern props. Pure and framework-free. */

/** Structural section names (Stage 9 §25 "Author page": credentials, published insights). */
export const personLabels = {
  credentials: "Credentials",
  insights: "Insights",
} as const;

/**
 * Verified external profile links. The view contract carries verified links only; this also
 * requires https and labels each link with its host, so no label is invented.
 */
export function profileLinks(person: PersonView): PatternLink[] {
  const seen = new Set<string>();
  return person.sameAs.flatMap((url) => {
    if (!isHttpsUrl(url) || seen.has(url)) return [];
    const label = hostLabel(url);
    if (!label) return [];
    seen.add(url);
    return [{ label, href: url }];
  });
}

/** Credentials whose evidence is verified. Anything else is not shown. */
export function verifiedCredentials(person: PersonView): string[] {
  return person.credentials
    .filter((credential) => credential.evidence.status === "verified")
    .map((credential) => credential.label)
    .filter((label) => label.trim() !== "");
}

/** Hero props. The portrait is optional: the hero renders a monogram without an approved image. */
export function personHeroProps(person: PersonView): Omit<PersonHeroProps, "children"> {
  const portrait = toPatternImage(person.portrait);
  const links = profileLinks(person);
  return {
    name: person.name,
    ...(person.role ? { role: person.role } : {}),
    ...(person.summary ? { intro: person.summary } : {}),
    ...(portrait ? { portrait } : {}),
    ...(links.length > 0 ? { links } : {}),
  };
}
