import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContentGap, PersonCard, PersonHero, ProcessJourney } from "@vitalos/ui";
import { Frame, OnEveryTone } from "../primitives/_frame";
import { sampleImage, text, url } from "./_fixtures";

const meta = {
  title: "Patterns/Journey, people and gaps",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const stages = [
  {
    title: "Example stage one (fixture)",
    summary: text.shortSummary,
    deliverables: ["Example deliverable A (fixture)", "Example deliverable B (fixture)"],
    evidence: "Example evidence (fixture)",
    decisionGate: "Example decision (fixture)",
  },
  {
    title: "Example stage two (fixture)",
    summary: text.summary,
    deliverables: ["Example deliverable (fixture)"],
  },
  { title: text.longTitle, decisionGate: text.longWord },
  { title: "Example stage four (fixture)" },
] as const;

export const Journey: Story = {
  name: "Process journey (4 stages)",
  render: () => (
    <OnEveryTone>
      <ProcessJourney
        aria-label="Example journey (fixture)"
        stages={[stages[0], stages[1], stages[2], stages[3]]}
      />
    </OnEveryTone>
  ),
};

export const JourneyMany: Story = {
  name: "Process journey (7 stages wrap)",
  render: () => (
    <Frame>
      <ProcessJourney
        stages={[
          stages[0],
          stages[1],
          stages[3],
          { title: "Example stage five (fixture)" },
          { title: "Example stage six (fixture)" },
          { title: "Example stage seven (fixture)" },
          { title: "Example stage eight (fixture)" },
        ]}
      />
    </Frame>
  ),
};

export const Journey320: Story = {
  name: "Process journey (320px, vertical)",
  render: () => (
    <Frame width={320}>
      <ProcessJourney stages={[stages[0], stages[2]]} />
    </Frame>
  ),
};

export const PersonCards: Story = {
  name: "Person cards (with and without portrait)",
  render: () => (
    <OnEveryTone>
      <ul className="m-0 grid list-none grid-cols-1 gap-8 p-0 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <PersonCard
            name="Example Person"
            role={text.role}
            href={url("person1")}
            expertise={["Example expertise (fixture)", "Example area (fixture)"]}
            portrait={sampleImage("Example portrait (fixture)", 400, 500)}
          />
        </li>
        <li>
          <PersonCard name="Example Person Two" role={text.role} href={url("person2")} />
        </li>
        <li>
          <PersonCard
            name="Example Person With A Very Long Name That Wraps"
            role={text.longTitle}
          />
        </li>
        <li>
          <PersonCard name="Example" />
        </li>
      </ul>
    </OnEveryTone>
  ),
};

export const PersonHeroWithPortrait: Story = {
  name: "Person hero",
  render: () => (
    <Frame>
      <PersonHero
        name="Example Person"
        role={text.role}
        intro={text.summary}
        portrait={sampleImage("Example portrait (fixture)", 400, 500)}
        links={[{ label: "Example profile (fixture)", href: url("profile") }]}
      >
        <p>Example biography paragraph (fixture).</p>
      </PersonHero>
    </Frame>
  ),
};

export const PersonHeroBare: Story = {
  name: "Person hero (no portrait, 320px)",
  render: () => (
    <Frame width={320}>
      <PersonHero name="Example Person With A Very Long Name That Wraps" role={text.longTitle} />
    </Frame>
  ),
};

export const ContentGapDraft: Story = {
  name: "Content gap (draft only)",
  render: () => (
    <OnEveryTone>
      <ContentGap
        draft
        title="Example missing section (fixture)"
        description="Example editor guidance (fixture): what is needed before this section can appear."
      />
    </OnEveryTone>
  ),
};

export const ContentGapPublic: Story = {
  name: "Content gap (not draft: renders nothing)",
  render: () => (
    <Frame>
      <p>Example surrounding content (fixture)</p>
      <ContentGap draft={false} title="Example missing section (fixture)" />
    </Frame>
  ),
};
