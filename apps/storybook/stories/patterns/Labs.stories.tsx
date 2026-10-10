import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  EvaluationTable,
  LabAssetRow,
  MaturityBadge,
  ResourceLinks,
  TechnicalFigure,
  type MaturityKey,
} from "@vitalos/ui";
import { Frame, OnEveryTone } from "../primitives/_frame";
import { sampleImage, text, url } from "./_fixtures";

const meta = {
  title: "Patterns/Labs",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const maturities: MaturityKey[] = [
  "research",
  "concept",
  "prototype",
  "accelerator",
  "beta",
  "production-product",
];

export const Badges: Story = {
  name: "Maturity badge (every stage; text plus outline style)",
  render: () => (
    <OnEveryTone>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {maturities.map((maturity) => (
          <li key={maturity}>
            <MaturityBadge maturity={maturity} label={`Example ${maturity} label (fixture)`} />
          </li>
        ))}
      </ul>
    </OnEveryTone>
  ),
};

export const AssetRows: Story = {
  name: "Lab asset rows",
  render: () => (
    <OnEveryTone>
      <LabAssetRow
        title="Example reference architecture (fixture)"
        href={url("lab1")}
        eyebrow="Example type (fixture)"
        maturity="prototype"
        maturityLabel="Example prototype label (fixture)"
        summary={text.summary}
        meta={[{ label: "Updated", value: "Example date (fixture)" }]}
      />
      <LabAssetRow
        title={text.longTitle}
        href={url("lab2")}
        maturity="production-product"
        maturityLabel="Example production label (fixture)"
      />
      <LabAssetRow
        title="Example research note (fixture)"
        href={url("lab3")}
        maturity="research"
        maturityLabel="Example research label (fixture)"
        summary={text.longWord}
      />
    </OnEveryTone>
  ),
};

export const AssetRow320: Story = {
  name: "Lab asset row (320px)",
  render: () => (
    <Frame width={320}>
      <LabAssetRow
        title={text.longTitle}
        href={url("lab")}
        maturity="beta"
        maturityLabel="Example beta label (fixture)"
        summary={text.summary}
      />
    </Frame>
  ),
};

export const FigureWithImage: Story = {
  name: "Technical figure (image)",
  render: () => (
    <Frame>
      <div className="max-w-2xl">
        <TechnicalFigure
          textAlternative="Example text alternative (fixture): describes the components and flows a real diagram would show."
          image={{ url: sampleImage("x", 800, 450).url, width: 800, height: 450 }}
          caption="Example figure caption (fixture)"
        />
      </div>
    </Frame>
  ),
};

export const FigureInline: Story = {
  name: "Technical figure (inline SVG, dark)",
  render: () => (
    <Frame tone="dark">
      <div className="max-w-2xl">
        <TechnicalFigure
          textAlternative="Example inline diagram alternative (fixture)"
          caption="Example inline caption (fixture)"
        >
          <svg viewBox="0 0 200 60" width="200" height="60" fill="none" stroke="currentColor">
            <rect x="4" y="10" width="60" height="40" />
            <rect x="136" y="10" width="60" height="40" />
            <path d="M64 30h72" />
          </svg>
        </TechnicalFigure>
      </div>
    </Frame>
  ),
};

export const Evaluation: Story = {
  name: "Evaluation table",
  render: () => (
    <OnEveryTone>
      <EvaluationTable
        caption="Example evaluation (fixture)"
        dimensionHeading="Example dimension (fixture)"
        columns={[
          "Example target (fixture)",
          "Example measured (fixture)",
          "Example method (fixture)",
        ]}
        rows={[
          {
            dimension: "Example quality (fixture)",
            values: ["00", "00", "Example method text (fixture)"],
          },
          { dimension: "Example latency (fixture)", values: ["00 ms", "00 ms", text.longWord] },
          { dimension: text.longTitle, values: ["00", "00", "Example (fixture)"] },
        ]}
      />
    </OnEveryTone>
  ),
};

export const Evaluation320: Story = {
  name: "Evaluation table (320px, stacks)",
  render: () => (
    <Frame width={320}>
      <EvaluationTable
        caption="Example evaluation (fixture)"
        dimensionHeading="Example dimension (fixture)"
        columns={["Example target (fixture)", "Example measured (fixture)"]}
        rows={[
          { dimension: "Example quality (fixture)", values: ["00", "00"] },
          { dimension: text.longTitle, values: [text.longWord, "00"] },
        ]}
      />
    </Frame>
  ),
};

export const Resources: Story = {
  name: "Resource links",
  render: () => (
    <OnEveryTone>
      <ResourceLinks
        heading="Example resources (fixture)"
        links={[
          {
            label: "Example repository (fixture)",
            href: url("repo"),
            description: "Example format (fixture)",
            external: true,
          },
          { label: "Example download (fixture)", href: url("download") },
          { label: text.longTitle, href: url("long") },
        ]}
      />
    </OnEveryTone>
  ),
};
