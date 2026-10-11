import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CertificationItem,
  EvidenceRequestCTA,
  PolicySummary,
  SubprocessorTable,
  TrustTopicRow,
} from "@vitalos/ui";
import { Frame, OnEveryTone } from "../primitives/_frame";
import { text, url } from "./_fixtures";

const meta = {
  title: "Patterns/Trust",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TopicRows: Story = {
  name: "Trust topic rows",
  render: () => (
    <OnEveryTone>
      <TrustTopicRow
        title="Example topic (fixture)"
        href={url("t1")}
        summary={text.summary}
        status="Example status (fixture)"
        meta={[{ label: "Last reviewed", value: "Example date (fixture)" }]}
      />
      <TrustTopicRow title={text.longTitle} href={url("t2")} />
    </OnEveryTone>
  ),
};

export const Certifications: Story = {
  name: "Certification items",
  render: () => (
    <OnEveryTone>
      <div className="grid gap-6 md:grid-cols-2">
        <CertificationItem
          name="Example certification (fixture)"
          scope="Example scope (fixture)"
          issuedAt="2026-01-31"
          expiresAt="2027-01-30"
          link={{ label: "Example evidence request (fixture)", href: url("cert") }}
        />
        <CertificationItem name={text.longTitle} scope={text.summary} issuedAt="2026-02-01" />
      </div>
    </OnEveryTone>
  ),
};

export const Policy: Story = {
  name: "Policy summary",
  render: () => (
    <OnEveryTone>
      <PolicySummary
        title="Example policy (fixture)"
        summary={text.summary}
        lastReviewed="2026-02-01"
        link={{ label: "Example full statement (fixture)", href: url("policy") }}
      />
    </OnEveryTone>
  ),
};

export const EvidenceRequest: Story = {
  name: "Evidence request CTA",
  render: () => (
    <OnEveryTone>
      <EvidenceRequestCTA
        heading="Example evidence request (fixture)"
        body={text.summary}
        cta={{ label: "Example request action (fixture)", href: url("contact?intent=procurement") }}
      />
    </OnEveryTone>
  ),
};

const rows = [
  {
    name: "Example provider one (fixture)",
    purpose: "Example purpose (fixture)",
    location: "Example location (fixture)",
  },
  { name: text.longTitle, purpose: text.longWord, location: "Example location (fixture)" },
];

export const Subprocessors: Story = {
  name: "Subprocessor table",
  render: () => (
    <OnEveryTone>
      <SubprocessorTable caption="Example subprocessors (fixture)" rows={rows} />
    </OnEveryTone>
  ),
};

export const SubprocessorsNoLocation: Story = {
  name: "Subprocessor table (no location column)",
  render: () => (
    <Frame>
      <SubprocessorTable
        caption="Example subprocessors (fixture)"
        rows={[{ name: "Example provider (fixture)", purpose: "Example purpose (fixture)" }]}
      />
    </Frame>
  ),
};

export const Subprocessors320: Story = {
  name: "Subprocessor table (320px, stacks)",
  render: () => (
    <Frame width={320}>
      <SubprocessorTable caption="Example subprocessors (fixture)" rows={rows} />
    </Frame>
  ),
};
