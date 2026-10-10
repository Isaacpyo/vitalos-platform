import "server-only";
import { cache } from "react";
import type { PersonView, PublicationGates } from "@vitalos/cms";
import { isDraftModeEnabled } from "../../lib/cms/draft";
import { getContentSource, getPublishedContentSource } from "../../lib/cms/get-content-source";

export interface PersonData {
  person: PersonView;
  gates: PublicationGates;
  draft: boolean;
}

export const loadPerson = cache(async (slug: string): Promise<PersonData | null> => {
  const source = await getContentSource();
  const [person, gates, draft] = await Promise.all([
    source.getDocument("person", slug),
    source.getPublicationGates(),
    isDraftModeEnabled(),
  ]);
  return person ? { person, gates, draft } : null;
});

export async function listPersonParams(): Promise<{ slug: string }[]> {
  const source = await getPublishedContentSource();
  return (await source.listParams("person")).flatMap((params) =>
    params.slug ? [{ slug: params.slug }] : [],
  );
}
