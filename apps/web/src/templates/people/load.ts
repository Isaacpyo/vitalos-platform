import "server-only";
import { cache } from "react";
import type { PersonView, PublicationGates } from "@vitalos/cms";
import { getContentSource } from "../../lib/cms/get-content-source";

export interface PersonData {
  person: PersonView;
  gates: PublicationGates;
}

export const loadPerson = cache(async (slug: string): Promise<PersonData | null> => {
  const source = await getContentSource();
  const [person, gates] = await Promise.all([
    source.getDocument("person", slug),
    source.getPublicationGates(),
  ]);
  return person ? { person, gates } : null;
});

export async function listPersonParams(): Promise<{ slug: string }[]> {
  const source = await getContentSource();
  return (await source.listParams("person")).flatMap((params) =>
    params.slug ? [{ slug: params.slug }] : [],
  );
}
