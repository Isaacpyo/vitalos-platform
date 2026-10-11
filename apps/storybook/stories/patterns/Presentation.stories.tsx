import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Breadcrumb,
  Button,
  Carousel,
  Container,
  HeroVisual,
  LinkCard,
  MediaPlaceholder,
  PageHero,
  ProcessJourney,
  Parallax,
  Reveal,
  RevealItem,
  Section,
  SettleText,
  SectionHeading,
  SolutionCard,
} from "@vitalos/ui";
import { Frame, OnEveryTone } from "../primitives/_frame";
import { text, url } from "./_fixtures";

/**
 * Section compositions ported from the owner comp (ADR-023). All text is artificial fixture
 * text; the comp's copy, figures, logos and photographs are never used.
 */
const meta = {
  title: "Patterns/Presentation",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const steps = [
  "Example stage one (fixture)",
  "Example stage two (fixture)",
  "Example stage three (fixture)",
  "Example stage four (fixture)",
];

export const SectionHeadingSplit: Story = {
  name: "Section heading (split, with intro and link)",
  render: () => (
    <OnEveryTone>
      <SectionHeading
        eyebrow={text.label}
        title={["Example heading line one (fixture)", "line two (fixture)"]}
        intro={text.summary}
        link={{ label: "Example onward link (fixture)", href: url("onward") }}
      />
    </OnEveryTone>
  ),
};

export const SectionHeadingPlain: Story = {
  name: "Section heading (title only, 320px)",
  render: () => (
    <Frame width={320}>
      <SectionHeading title={text.longTitle} />
    </Frame>
  ),
};

export const PageHeroDisplay: Story = {
  name: "Page hero",
  render: () => (
    <PageHero
      before={
        <Breadcrumb
          items={[
            { label: "Example home (fixture)", href: url("") },
            { label: "Example page (fixture)" },
          ]}
        />
      }
      eyebrow={text.label}
      title="Example page title (fixture)"
      lead={text.summary}
      actions={
        <Button href={url("contact")} arrow>
          Example action (fixture)
        </Button>
      }
    />
  ),
};

export const PageHeroTitle: Story = {
  name: "Page hero (content page, long title)",
  render: () => <PageHero size="title" containerSize="content" title={text.longTitle} />,
};

export const Hero: Story = {
  name: "Hero visual (decorative)",
  render: () => (
    <Section as="div" tone="light">
      <Container size="wide" className="grid gap-8 lg:grid-cols-2">
        <p className="text-display-l text-tone-heading">Example hero statement (fixture)</p>
        <HeroVisual steps={steps} className="aspect-[4/3] w-full" />
      </Container>
    </Section>
  ),
};

export const HeroWithoutSteps: Story = {
  name: "Hero visual (no panel)",
  render: () => (
    <Frame>
      <HeroVisual className="aspect-[3/2] w-full max-w-xl" />
    </Frame>
  ),
};

export const Placeholders: Story = {
  name: "Media placeholders (decorative, token tints)",
  render: () => (
    <Frame>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {([0, 1, 2, 3] as const).map((variant) => (
          <MediaPlaceholder key={variant} variant={variant} className="aspect-[16/9] rounded-lg" />
        ))}
      </div>
    </Frame>
  ),
};

export const CardsWithIcons: Story = {
  name: "Cards with icon tiles and placeholders",
  render: () => (
    <OnEveryTone>
      <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <SolutionCard title={text.title} summary={text.summary} href={url("a")} icon="chip" />
        </li>
        <li>
          <SolutionCard
            title={text.longTitle}
            summary={text.shortSummary}
            href={url("b")}
            icon="workflow"
            titleSize="h4"
          />
        </li>
        <li>
          <LinkCard
            kind="industry"
            title={text.title}
            summary={text.shortSummary}
            href={url("c")}
            icon="building"
            placeholder={1}
            titleSize="h4"
          />
        </li>
        <li>
          <LinkCard kind="insight" title={text.title} href={url("d")} placeholder={2} />
        </li>
      </ul>
    </OnEveryTone>
  ),
};

const carouselItems = Array.from({ length: 7 }, (_, index) => index + 1);

export const CarouselRow: Story = {
  name: "Carousel (row with drag and arrow-key paging from lg; stacked list below)",
  render: () => (
    <Frame>
      <Carousel
        label="Example items (fixture)"
        previousLabel="Previous: Example items (fixture)"
        nextLabel="Next: Example items (fixture)"
      >
        {carouselItems.map((n) => (
          <li key={n}>
            <LinkCard
              kind="industry"
              title={`Example item ${n} (fixture)`}
              summary={text.shortSummary}
              href={url(`item-${n}`)}
              icon="building"
              placeholder={((n - 1) % 4) as 0 | 1 | 2 | 3}
              titleSize="h4"
            />
          </li>
        ))}
      </Carousel>
    </Frame>
  ),
};

export const Journey: Story = {
  name: "Process journey (connected steps)",
  render: () => (
    <OnEveryTone>
      <ProcessJourney
        stages={[
          { title: steps[0]!, summary: text.shortSummary },
          { title: steps[1]!, summary: text.shortSummary },
          { title: steps[2]!, summary: text.shortSummary },
          { title: steps[3]!, summary: text.shortSummary },
        ]}
        aria-label="Example journey (fixture)"
      />
    </OnEveryTone>
  ),
};

export const JourneyGrid: Story = {
  name: "Process journey (more than five stages: grid)",
  render: () => (
    <Frame>
      <ProcessJourney
        stages={
          [1, 2, 3, 4, 5, 6, 7].map((n) => ({ title: `Example stage ${n} (fixture)` })) as [
            { title: string },
            ...{ title: string }[],
          ]
        }
        aria-label="Example long journey (fixture)"
      />
    </Frame>
  ),
};

export const Entrances: Story = {
  name: "Reveal (scroll down; nothing hides under reduced motion)",
  render: () => (
    <div>
      {[1, 2, 3, 4].map((n) => (
        <Section key={n} as="div" tone={n % 2 ? "light" : "muted"}>
          <Container size="wide">
            <Reveal>
              <SectionHeading title={`Example revealed section ${n} (fixture)`} />
            </Reveal>
            <Reveal delay={1} className="mt-6">
              <p className="text-body text-tone-text">{text.summary}</p>
            </Reveal>
          </Container>
        </Section>
      ))}
    </div>
  ),
};

export const StaggeredCards: Story = {
  name: "Reveal stagger (cards enter in sequence below the fold)",
  render: () => (
    <div>
      <Section as="div" tone="muted" className="min-h-[110vh]">
        <Container size="wide">
          <SectionHeading title="Example spacer section, scroll down (fixture)" />
        </Container>
      </Section>
      <Section as="div" tone="light">
        <Container size="wide">
          <Reveal
            as="ul"
            stagger
            className="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 lg:grid-cols-3"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <RevealItem as="li" key={n} className="min-w-0">
                <SolutionCard
                  title={`Example card ${n} (fixture)`}
                  summary={text.shortSummary}
                  href={url(`card-${n}`)}
                  icon="workflow"
                />
              </RevealItem>
            ))}
          </Reveal>
        </Container>
      </Section>
    </div>
  ),
};

export const HeadlineSettle: Story = {
  name: "Headline settle (words rise into place in under 400ms; text never hidden)",
  render: () => (
    <Frame>
      <h1 className="text-display-xl text-tone-heading text-balance">
        <SettleText
          parts={[
            { text: "Example fixture headline that wraps over several lines and " },
            { text: "ends in an accent.", accent: true },
          ]}
        />
      </h1>
    </Frame>
  ),
};

export const ParallaxPlane: Story = {
  name: "Parallax (one decorative plane; static under reduced motion)",
  render: () => (
    <div className="min-h-[200vh]">
      <Section as="div" tone="light">
        <Container size="wide">
          <div className="relative h-80 overflow-hidden rounded-xl border border-tone-border">
            <Parallax className="absolute inset-y-[10%] left-[10%] w-1/2" travel={-40}>
              <div className="h-full w-full -skew-x-12 rounded-xl bg-linear-160 from-blue-100 to-blue-50" />
            </Parallax>
          </div>
          <p className="mt-6 text-body text-tone-text">{text.summary}</p>
        </Container>
      </Section>
    </div>
  ),
};
