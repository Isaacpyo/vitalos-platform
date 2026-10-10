import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AnchorNav,
  Breadcrumb,
  Callout,
  DefinitionList,
  Disclosure,
  MetaRow,
  Quote,
  Rule,
  Stack,
  Stat,
  Tag,
} from "@vitalos/ui";
import { Frame, OnEveryTone, sample } from "./_frame";

const meta = {
  title: "Primitives/Content",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DisclosureClosedAndOpen: Story = {
  render: () => (
    <Frame>
      <div className="max-w-xl">
        <Disclosure summary="Example closed disclosure (fixture)">{sample.paragraph}</Disclosure>
        <Disclosure summary="Example open disclosure (fixture)" open>
          {sample.paragraph}
        </Disclosure>
        <Disclosure summary={sample.longHeading}>{sample.paragraph}</Disclosure>
      </div>
    </Frame>
  ),
};

export const DisclosureOnDark: Story = {
  render: () => (
    <Frame tone="dark">
      <Disclosure summary="Example disclosure on midnight (fixture)" open>
        {sample.paragraph}
      </Disclosure>
    </Frame>
  ),
};

export const TagsAndMeta: Story = {
  render: () => (
    <OnEveryTone>
      <Stack gap={3}>
        <Stack as="ul" direction="row" wrap gap={2}>
          <Tag as="li">Example topic (fixture)</Tag>
          <Tag as="li">Example format (fixture)</Tag>
        </Stack>
        <MetaRow
          items={[
            { label: "Author", value: "Example Author (fixture)" },
            { label: "Published", value: "Example date (fixture)", hideLabel: true },
            { label: "Read time", value: "Example duration (fixture)" },
          ]}
        />
      </Stack>
    </OnEveryTone>
  ),
};

export const MetaRowNarrow: Story = {
  name: "Meta row (320px, long labels wrap between words)",
  render: () => (
    <Frame width={240}>
      <MetaRow
        items={[
          { label: "Engagement", value: "Example long engagement description (fixture)" },
          { label: "Client", value: "Example client (fixture)" },
        ]}
      />
    </Frame>
  ),
};

export const Stats: Story = {
  render: () => (
    <OnEveryTone>
      <div className="grid gap-8 md:grid-cols-2">
        <Stat
          value="00"
          descriptor="Example measure (fixture)"
          context="Example timeframe (fixture)"
          source={sample.source}
        />
        <Stat value="00%" descriptor={sample.longHeading} source={sample.source} />
      </div>
    </OnEveryTone>
  ),
};

export const Quotes: Story = {
  render: () => (
    <OnEveryTone>
      <Quote attribution={sample.attribution}>Example quotation text (fixture)</Quote>
    </OnEveryTone>
  ),
};

export const QuoteLongAt320: Story = {
  render: () => (
    <Frame width={320}>
      <Quote attribution={sample.attribution}>{sample.paragraph}</Quote>
    </Frame>
  ),
};

export const Callouts: Story = {
  render: () => (
    <OnEveryTone>
      <Stack gap={4}>
        <Callout title="Example callout title (fixture)">{sample.paragraph}</Callout>
        <Callout>{sample.paragraph}</Callout>
      </Stack>
    </OnEveryTone>
  ),
};

export const Definitions: Story = {
  render: () => (
    <Frame>
      <DefinitionList
        items={[
          { term: "Example term one (fixture)", description: sample.paragraph },
          { term: "Example term two (fixture)", description: "Example description (fixture)" },
          { term: sample.longHeading, description: sample.longWord },
        ]}
      />
      <Rule />
    </Frame>
  ),
};

export const Navigation: Story = {
  render: () => (
    <Frame>
      <Stack gap={5}>
        <Breadcrumb
          items={[
            { label: "Example home (fixture)", href: "#home" },
            { label: "Example section (fixture)", href: "#section" },
            { label: "Example current page (fixture)" },
          ]}
        />
        <AnchorNav
          currentId="two"
          items={[
            { id: "one", label: "Example anchor one (fixture)" },
            { id: "two", label: "Example anchor two (fixture)" },
            { id: "three", label: "Example anchor three (fixture)" },
          ]}
        />
      </Stack>
    </Frame>
  ),
};

export const NavigationOn320: Story = {
  render: () => (
    <Frame width={320}>
      <Stack gap={5}>
        <Breadcrumb
          items={[
            { label: "Example home (fixture)", href: "#home" },
            { label: sample.longHeading, href: "#section" },
            { label: sample.longHeading },
          ]}
        />
        <AnchorNav
          items={[
            { id: "one", label: sample.longHeading },
            { id: "two", label: "Example anchor two (fixture)" },
          ]}
        />
      </Stack>
    </Frame>
  ),
};

export const NavigationOnDark: Story = {
  render: () => (
    <Frame tone="dark">
      <Stack gap={5}>
        <Breadcrumb
          items={[
            { label: "Example home (fixture)", href: "#home" },
            { label: "Example current page (fixture)" },
          ]}
        />
        <AnchorNav items={[{ id: "one", label: "Example anchor one (fixture)" }]} />
      </Stack>
    </Frame>
  ),
};
