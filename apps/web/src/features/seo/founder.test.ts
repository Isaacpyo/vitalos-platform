import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  site: undefined as { aboutFounderEnabled?: boolean } | undefined,
}));
vi.mock("@vitalos/config", () => ({ getEnv: () => env }));

const { aboutFounderEnabled, founderPersonNode } = await import("./founder");

const ctx = { siteUrl: "https://www.example.invalid" };
const founder = {
  name: "Example Founder",
  slug: "example-founder",
  roleTitle: "Founder",
  linkedinUrl: "https://www.linkedin.com/in/example",
};

describe("founder Person on About (C11, behind ABOUT_FOUNDER_ENABLED)", () => {
  afterEach(() => {
    env.site = undefined;
  });

  it("is off until the flag exists and is on", () => {
    expect(aboutFounderEnabled()).toBe(false);
    expect(founderPersonNode(founder, ctx)).toBeNull();
    env.site = { aboutFounderEnabled: false };
    expect(founderPersonNode(founder, ctx)).toBeNull();
  });

  it("describes the author profile's person, with the author page's @id", () => {
    env.site = { aboutFounderEnabled: true };
    expect(founderPersonNode(founder, ctx)).toEqual({
      "@type": "Person",
      "@id": "https://www.example.invalid/insights/authors/example-founder#person",
      name: "Example Founder",
      url: "https://www.example.invalid/insights/authors/example-founder",
      jobTitle: "Founder",
      worksFor: { "@id": "https://www.example.invalid/#organization" },
      sameAs: ["https://www.linkedin.com/in/example"],
    });
    expect(founderPersonNode(null, ctx)).toBeNull();
  });
});
