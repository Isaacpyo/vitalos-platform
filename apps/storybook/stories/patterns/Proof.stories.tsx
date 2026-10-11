import type { Meta, StoryObj } from "@storybook/react-vite";
import { CaseStudyFeature, CaseStudyRow, OutcomeStats, ProofStrip, Testimonial } from "@vitalos/ui";
import { Frame, OnEveryTone } from "../primitives/_frame";
import { metric, sampleImage, text, url } from "./_fixtures";

const meta = {
  title: "Patterns/Proof",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Strip: Story = {
  name: "Proof strip",
  render: () => (
    <OnEveryTone>
      <ProofStrip
        label="Example verified proof (fixture)"
        items={[
          { label: "Example marker one (fixture)", evidence: { status: "verified" } },
          {
            label: "Example marker two (fixture)",
            href: url("proof"),
            evidence: { status: "verified" },
          },
          { label: text.longTitle, evidence: { status: "verified" } },
          { label: "Example unverified marker (fixture)", evidence: { status: "pending" } },
        ]}
      />
    </OnEveryTone>
  ),
};

export const StripWithLogo: Story = {
  name: "Proof strip (with approved logo)",
  render: () => (
    <Frame>
      <ProofStrip
        items={[
          {
            label: "Example logo marker (fixture)",
            logo: sampleImage("Example logo (fixture)", 120, 40),
            evidence: { status: "verified" },
          },
        ]}
      />
    </Frame>
  ),
};

export const StripNothingVerified: Story = {
  name: "Proof strip (nothing verified: renders nothing)",
  render: () => (
    <Frame>
      <p>Example surrounding content (fixture)</p>
      <ProofStrip items={[{ label: "Example (fixture)", evidence: { status: "pending" } }]} />
    </Frame>
  ),
};

const stats = [
  metric,
  { ...metric, value: "00", descriptor: text.longTitle, context: undefined, timeframe: undefined },
  { ...metric, value: "0x", descriptor: "Example other measure (fixture)" },
  { ...metric, value: "000", descriptor: "Example fourth measure (fixture)" },
];

export const Outcomes: Story = {
  name: "Outcome stats",
  render: () => (
    <OnEveryTone>
      <OutcomeStats
        aria-label="Example outcomes (fixture)"
        stats={[stats[0]!, stats[1]!, stats[2]!, stats[3]!]}
      />
    </OnEveryTone>
  ),
};

export const OutcomesSingleAndUnsourced: Story = {
  name: "Outcome stats (one; unsourced dropped)",
  render: () => (
    <Frame>
      <OutcomeStats stats={[metric, { ...metric, value: "99%", source: "" }]} />
    </Frame>
  ),
};

export const Outcomes320: Story = {
  name: "Outcome stats (320px)",
  render: () => (
    <Frame width={320}>
      <OutcomeStats stats={[stats[0]!, stats[1]!]} />
    </Frame>
  ),
};

export const TestimonialStory: Story = {
  name: "Testimonial",
  render: () => (
    <OnEveryTone>
      <Testimonial
        quote="Example quotation (fixture). Placeholder words, not a real testimonial."
        attribution="Example Person"
        role={text.role}
      />
    </OnEveryTone>
  ),
};

export const TestimonialLong320: Story = {
  name: "Testimonial (long, 320px)",
  render: () => (
    <Frame width={320}>
      <Testimonial
        quote={text.summary + " " + text.summary}
        attribution="Example Person"
        role={text.longTitle}
      />
    </Frame>
  ),
};

export const CaseStudyFeatures: Story = {
  name: "Case study feature",
  render: () => (
    <OnEveryTone>
      <CaseStudyFeature
        title="Example outcome-led headline (fixture)"
        href={url("case")}
        sector="Example sector (fixture)"
        challenge={text.summary}
        metrics={[stats[0]!, stats[2]!, stats[3]!, stats[1]!]}
        meta={[
          { label: "Client", value: "Example anonymised client (fixture)" },
          { label: "Basis", value: "Example engagement basis (fixture)" },
        ]}
      />
    </OnEveryTone>
  ),
};

export const CaseStudyFeatureWithImage: Story = {
  name: "Case study feature (with image)",
  render: () => (
    <Frame>
      <CaseStudyFeature
        title={text.longTitle}
        href={url("case")}
        challenge={text.summary}
        metrics={[metric]}
        image={sampleImage("Example image (fixture)", 800, 600)}
      />
    </Frame>
  ),
};

export const CaseStudyFeatureBare: Story = {
  name: "Case study feature (no image, no metrics, 320px)",
  render: () => (
    <Frame width={320}>
      <CaseStudyFeature title={text.longTitle} href={url("case")} />
    </Frame>
  ),
};

export const CaseStudyRows: Story = {
  name: "Case study rows",
  render: () => (
    <OnEveryTone>
      <CaseStudyRow
        title="Example case study (fixture)"
        href={url("c1")}
        eyebrow="Example sector (fixture)"
        summary={text.summary}
        metrics={[metric]}
      />
      <CaseStudyRow title={text.longTitle} href={url("c2")} />
    </OnEveryTone>
  ),
};
