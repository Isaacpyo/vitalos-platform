import { describe, expect, it } from "vitest";
import type { PersonView } from "@vitalos/cms";
import { fullFixtureSet } from "@vitalos/cms/fixtures";
import { personHeroProps, profileLinks, verifiedCredentials } from "./map";

const [full, bare] = fullFixtureSet.documents.person as [PersonView, PersonView];

describe("person mapping", () => {
  it("builds hero props without a portrait", () => {
    const props = personHeroProps(full);
    expect(props.name).toBe(full.name);
    expect(props.portrait).toBeUndefined();
    expect(props.links).toEqual([{ label: "example.invalid", href: full.sameAs[0] }]);
  });

  it("works for a profile with almost nothing", () => {
    expect(personHeroProps(bare)).toMatchObject({ name: bare.name });
    expect(personHeroProps(bare).links).toBeUndefined();
  });

  it("keeps https profile links only, once each", () => {
    const links = profileLinks({
      ...full,
      sameAs: [
        "https://www.example.invalid/a",
        "https://www.example.invalid/a",
        "http://example.invalid/b",
        "javascript:alert(1)",
        "not a url",
      ],
    });
    expect(links).toEqual([{ label: "example.invalid", href: "https://www.example.invalid/a" }]);
  });

  it("shows verified credentials only", () => {
    expect(verifiedCredentials(full)).toHaveLength(1);
    expect(
      verifiedCredentials({
        ...full,
        credentials: [{ label: "Pending one", evidence: { status: "pending" } }],
      }),
    ).toEqual([]);
  });

  it("drops a portrait that is not renderable", () => {
    const withBadPortrait = {
      ...full,
      portrait: { url: "https://elsewhere.invalid/p.jpg", alt: "Portrait", width: 10, height: 10 },
    };
    expect(personHeroProps(withBadPortrait).portrait).toBeUndefined();
    const ok = {
      ...full,
      portrait: { url: "/portrait.jpg", alt: "Portrait", width: 10, height: 10 },
    };
    expect(personHeroProps(ok).portrait).toMatchObject({ url: "/portrait.jpg" });
    const noAlt = { ...ok, portrait: { ...ok.portrait, alt: "" } };
    expect(personHeroProps(noAlt).portrait).toBeUndefined();
  });
});
