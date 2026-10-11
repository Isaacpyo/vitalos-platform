import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArticleFeature,
  ArticleRow,
  AuthorMeta,
  CodeBlock,
  Figure,
  TableOfContents,
} from "@vitalos/ui";
import { Frame, OnEveryTone } from "../primitives/_frame";
import { sampleImage, text, url } from "./_fixtures";

const meta = {
  title: "Patterns/Insights",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const authors = [
  { name: "Example Author One", href: url("a1") },
  { name: "Example Author Two", href: url("a2") },
];

export const FeatureNoImage: Story = {
  name: "Article feature",
  render: () => (
    <OnEveryTone>
      <ArticleFeature
        title="Example featured insight (fixture)"
        href={url("art")}
        eyebrow="Example format (fixture)"
        summary={text.summary}
        authors={authors}
        publishedAt="2026-03-01"
        readTime="Example read time (fixture)"
      />
    </OnEveryTone>
  ),
};

export const FeatureWithImage: Story = {
  name: "Article feature (with image, long title)",
  render: () => (
    <Frame>
      <ArticleFeature
        title={text.longTitle}
        href={url("art")}
        summary={text.summary}
        image={sampleImage("Example image (fixture)", 800, 500)}
        authors={authors}
        publishedAt="2026-03-01"
        updatedAt="2026-04-01"
      />
    </Frame>
  ),
};

export const Feature320: Story = {
  name: "Article feature (320px)",
  render: () => (
    <Frame width={320}>
      <ArticleFeature
        title={text.longTitle}
        href={url("art")}
        summary={text.summary}
        authors={authors}
        publishedAt="2026-03-01"
      />
    </Frame>
  ),
};

export const Rows: Story = {
  name: "Article rows",
  render: () => (
    <OnEveryTone>
      <ArticleRow
        title="Example insight (fixture)"
        href={url("r1")}
        eyebrow="Example format (fixture)"
        summary={text.summary}
        authors={authors}
        publishedAt="2026-03-01"
      />
      <ArticleRow title={text.longTitle} href={url("r2")} />
    </OnEveryTone>
  ),
};

export const Authors: Story = {
  name: "Author meta",
  render: () => (
    <OnEveryTone>
      <div className="grid gap-4">
        <AuthorMeta
          authors={[authors[0]!]}
          publishedAt="2026-03-01"
          updatedAt="2026-04-02"
          readTime="Example read time (fixture)"
        />
        <AuthorMeta authors={authors} publishedAt="2026-03-01" />
        <AuthorMeta publishedAt="2026-03-01" />
      </div>
    </OnEveryTone>
  ),
};

export const Contents: Story = {
  name: "Table of contents",
  render: () => (
    <OnEveryTone>
      <div className="max-w-xs">
        <TableOfContents
          currentId="two"
          items={[
            { id: "one", label: "Example heading one (fixture)" },
            { id: "two", label: "Example heading two (fixture)" },
            { id: "two-a", label: "Example nested heading (fixture)", level: 3 },
            { id: "three", label: text.longTitle },
          ]}
        />
      </div>
    </OnEveryTone>
  ),
};

const code = `// Example code (fixture)
export function example(input: string): string {
  return input.trim().toLowerCase(); // a deliberately long line to exercise horizontal scrolling at narrow widths
}`;

export const Code: Story = {
  name: "Code block",
  render: () => (
    <OnEveryTone>
      <div className="max-w-2xl">
        <CodeBlock code={code} language="ts" />
      </div>
    </OnEveryTone>
  ),
};

export const Code320: Story = {
  name: "Code block (320px, no language)",
  render: () => (
    <Frame width={320}>
      <CodeBlock code={code} aria-label="Example code excerpt (fixture)" />
    </Frame>
  ),
};

export const Figures: Story = {
  name: "Figure",
  render: () => (
    <Frame>
      <div className="grid max-w-2xl gap-6">
        <Figure
          image={{
            ...sampleImage("Example figure image (fixture)", 800, 450),
            credit: "Example credit (fixture)",
          }}
          caption="Example caption (fixture)."
        />
        <Figure image={sampleImage("Example uncaptioned image (fixture)", 400, 400)} />
      </div>
    </Frame>
  ),
};
