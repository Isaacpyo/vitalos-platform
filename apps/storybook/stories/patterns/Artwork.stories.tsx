import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  HeroArtwork,
  LineDiagram,
  PageHero,
  Section,
  artworkFamilies,
  lineDiagramNames,
} from "@vitalos/ui";

/**
 * The brand-system artwork (ADR-044): one composition per page family, drawn from the brand's
 * graphic language with tokens only, and the line diagrams of the six solutions. Every picture is
 * decorative and deterministic: the same family and seed always draw the same thing.
 */
const meta = {
  title: "Patterns/Artwork",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Families: Story = {
  name: "Hero artwork (every family, dark and light)",
  render: () => (
    <>
      {(["dark", "muted"] as const).map((tone) => (
        <Section key={tone} tone={tone} spacing="compact">
          <ul className="m-0 grid list-none gap-(--space-5) p-(--space-5) md:grid-cols-2 xl:grid-cols-3">
            {artworkFamilies.map((family) => (
              <li key={family} className="border border-tone-border">
                <HeroArtwork family={family} seed="example" className="aspect-[2/1] w-full" />
                <p className="m-0 px-(--space-3) py-(--space-2) font-mono text-small text-tone-muted">
                  {family}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </>
  ),
};

export const ItemVariants: Story = {
  name: "Item variants (What We Do and Industries, strip crop)",
  render: () => (
    <Section tone="muted" spacing="compact">
      <ul className="m-0 grid list-none gap-(--space-4) p-(--space-5) md:grid-cols-3">
        {[
          "consulting",
          "engineering",
          "ai-data",
          "experience",
          "managed-services",
          "health-care",
        ].map((seed, index) => (
          <li key={seed} className="border border-tone-border">
            <HeroArtwork
              family={index < 5 ? "what-we-do" : "industries"}
              seed={seed}
              crop="strip"
              className="aspect-[3/1] w-full"
            />
          </li>
        ))}
      </ul>
    </Section>
  ),
};

export const Diagrams: Story = {
  name: "Solution line diagrams",
  render: () => (
    <Section tone="dark" spacing="compact">
      <ul className="m-0 grid list-none grid-cols-2 gap-(--space-5) p-(--space-5) md:grid-cols-3">
        {lineDiagramNames.map((name) => (
          <li key={name} className="border border-tone-border p-(--space-6)">
            <LineDiagram name={name} className="aspect-square w-full" />
            <p className="m-0 mt-(--space-3) font-mono text-small text-tone-muted">{name}</p>
          </li>
        ))}
      </ul>
    </Section>
  ),
};

export const HeroFamilies: Story = {
  name: "Page hero (home, Industries, light reading page, 390px)",
  render: () => (
    <div className="pt-(--size-header)">
      <PageHero
        tone="dark"
        artwork={{ family: "home" }}
        title="Example top-level page (fixture)"
        lead="Example lead sentence for the hero (fixture)."
      />
      <PageHero
        tone="dark"
        size="title"
        artwork={{ family: "industries", seed: "example" }}
        title="Example industry page (fixture)"
      />
      <PageHero
        size="title"
        artwork={{ family: "insights", seed: "example" }}
        title="Example article title (fixture)"
      />
    </div>
  ),
};
