import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  IndustryRow,
  LinkCard,
  OfferRow,
  PracticeRow,
  RelatedContentRail,
  SolutionCard,
  type LinkCardProps,
} from "@vitalos/ui";
import { Frame, OnEveryTone } from "../primitives/_frame";
import { sampleImage, text, url } from "./_fixtures";

const meta = {
  title: "Patterns/Commercial",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const PracticeRows: Story = {
  render: () => (
    <OnEveryTone>
      <div>
        <PracticeRow title={text.title} href={url("p1")} summary={text.summary} />
        <PracticeRow
          title="Example practice two (fixture)"
          href={url("p2")}
          eyebrow="Example label (fixture)"
          summary={text.shortSummary}
        />
        <PracticeRow title="Example title-only practice (fixture)" href={url("p3")} />
        <PracticeRow title={text.longTitle} href={url("p4")} summary={text.longWord} />
      </div>
    </OnEveryTone>
  ),
};

export const PracticeRows320: Story = {
  name: "Practice rows (320px)",
  render: () => (
    <Frame width={320}>
      <PracticeRow title={text.longTitle} href={url("p1")} summary={text.summary} />
      <PracticeRow title={text.longWord} href={url("p2")} summary={text.longWord} />
    </Frame>
  ),
};

export const OfferAndIndustryRows: Story = {
  render: () => (
    <Frame>
      <OfferRow
        title="Example offer (fixture)"
        href={url("o1")}
        summary={text.summary}
        meta={[
          { label: "Audience", value: "Example audience (fixture)" },
          { label: "Duration", value: "Example duration (fixture)" },
        ]}
      />
      <IndustryRow
        title="Example industry (fixture)"
        href={url("i1")}
        summary={text.shortSummary}
      />
      <OfferRow title={text.longTitle} href={url("o2")} />
    </Frame>
  ),
};

export const OfferAndIndustryRowsDark: Story = {
  name: "Offer and industry rows (dark)",
  render: () => (
    <Frame tone="dark">
      <OfferRow
        title="Example offer (fixture)"
        href={url("o1")}
        summary={text.summary}
        meta={[{ label: "Duration", value: "Example duration (fixture)" }]}
      />
      <IndustryRow
        title="Example industry (fixture)"
        href={url("i1")}
        summary={text.shortSummary}
      />
    </Frame>
  ),
};

export const SolutionCards: Story = {
  render: () => (
    <OnEveryTone>
      <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
        <li>
          <SolutionCard
            title="Example solution (fixture)"
            href={url("s1")}
            summary={text.summary}
            eyebrow="Example label (fixture)"
          />
        </li>
        <li>
          <SolutionCard
            title="Example with image (fixture)"
            href={url("s2")}
            summary={text.shortSummary}
            image={sampleImage("Example image (fixture)")}
          />
        </li>
        <li>
          <SolutionCard title={text.longTitle} href={url("s3")} summary={text.longWord} />
        </li>
      </ul>
    </OnEveryTone>
  ),
};

export const SolutionCard320: Story = {
  name: "Solution card (320px)",
  render: () => (
    <Frame width={320}>
      <SolutionCard
        title={text.longTitle}
        href={url("s1")}
        summary={text.summary}
        image={sampleImage("Example image (fixture)")}
      />
    </Frame>
  ),
};

const kinds: LinkCardProps[] = [
  {
    kind: "practice",
    eyebrow: "Example practice label (fixture)",
    title: "Example related practice (fixture)",
    href: url("r1"),
    summary: text.shortSummary,
  },
  {
    kind: "solution",
    eyebrow: "Example solution label (fixture)",
    title: "Example related solution (fixture)",
    href: url("r2"),
  },
  {
    kind: "case-study",
    eyebrow: "Example case study label (fixture)",
    title: text.longTitle,
    href: url("r3"),
    summary: text.summary,
  },
  {
    kind: "insight",
    eyebrow: "Example insight label (fixture)",
    title: "Example related insight (fixture)",
    href: url("r4"),
    meta: [{ label: "Published", value: "Example date (fixture)" }],
  },
  {
    kind: "lab",
    eyebrow: "Example lab label (fixture)",
    title: "Example related lab asset (fixture)",
    href: url("r5"),
    summary: text.shortSummary,
  },
];

export const LinkCards: Story = {
  render: () => (
    <OnEveryTone>
      <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
        {kinds.map((card) => (
          <li key={card.kind}>
            <LinkCard {...card} />
          </li>
        ))}
      </ul>
    </OnEveryTone>
  ),
};

export const RelatedRail: Story = {
  name: "Related content rail",
  render: () => (
    <OnEveryTone>
      <RelatedContentRail
        heading="Example related heading (fixture)"
        items={[kinds[0]!, ...kinds.slice(1)]}
      />
    </OnEveryTone>
  ),
};

export const RelatedRailOneItem: Story = {
  name: "Related content rail (one item, 320px)",
  render: () => (
    <Frame width={320}>
      <RelatedContentRail heading={text.longTitle} items={[kinds[2]!]} />
    </Frame>
  ),
};
