import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ArticleFeature,
  ArticleRow,
  AuthorMeta,
  CaseStudyFeature,
  CaseStudyRow,
  CertificationItem,
  CodeBlock,
  ContentGap,
  EvaluationTable,
  EvidenceRequestCTA,
  Figure,
  IndustryRow,
  LabAssetRow,
  LinkCard,
  MaturityBadge,
  OfferRow,
  OutcomeStats,
  PersonCard,
  PersonHero,
  PolicySummary,
  PracticeRow,
  ProcessJourney,
  ProofStrip,
  RelatedContentRail,
  ResourceLinks,
  SiteFooter,
  SolutionCard,
  SubprocessorTable,
  TableOfContents,
  TechnicalFigure,
  Testimonial,
  TerminalCTA,
  TrustTopicRow,
  isNonEmpty,
} from "./index";

afterEach(cleanup);

const url = (path: string) => `https://example.invalid/${path}`;
const long =
  "Example title (fixture) that is deliberately very long so that it has to wrap across many lines at a narrow viewport width";
const stat = {
  value: "00%",
  descriptor: "Example measure (fixture)",
  source: "Example source (fixture)",
};

describe("empty and absent data", () => {
  it("ProofStrip renders nothing for an empty list and for unverified items", () => {
    const empty = render(<ProofStrip items={[] as unknown as [never]} />);
    expect(empty.container.firstChild).toBeNull();
    const unverified = render(
      <ProofStrip items={[{ label: "Example (fixture)", evidence: { status: "pending" } }]} />,
    );
    expect(unverified.container.firstChild).toBeNull();
  });

  it("ProofStrip renders verified markers only", () => {
    render(
      <ProofStrip
        label="Example proof (fixture)"
        items={[
          { label: "Verified one (fixture)", evidence: { status: "verified" } },
          { label: "Pending one (fixture)", evidence: { status: "pending" } },
          { label: "Linked (fixture)", href: url("proof"), evidence: { status: "verified" } },
        ]}
      />,
    );
    expect(screen.getByText("Verified one (fixture)")).toBeTruthy();
    expect(screen.queryByText("Pending one (fixture)")).toBeNull();
    expect(screen.getByRole("link", { name: "Linked (fixture)" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("OutcomeStats renders nothing for an empty list and drops unsourced stats", () => {
    expect(
      render(<OutcomeStats stats={[] as unknown as [never]} />).container.firstChild,
    ).toBeNull();
    const dropped = render(<OutcomeStats stats={[{ ...stat, source: "  " }]} />);
    expect(dropped.container.firstChild).toBeNull();
  });

  it("OutcomeStats shows sourced stats with context and timeframe, at most four", () => {
    render(
      <OutcomeStats
        stats={[
          { ...stat, context: "Example scope (fixture)", timeframe: "Example period (fixture)" },
          stat,
          stat,
          stat,
          stat,
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByText(/Source:/)).toHaveLength(4);
    expect(screen.getByText("Example scope (fixture) · Example period (fixture)")).toBeTruthy();
  });

  it("OutcomeStats drops stats whose evidence is not verified", () => {
    render(
      <OutcomeStats
        stats={[
          { ...stat, evidence: { status: "pending" } },
          { ...stat, value: "11%", evidence: { status: "verified" } },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    // The verified figure renders twice: the visual copy (aria-hidden, counted up on scroll) and
    // the copy assistive technology reads.
    const copies = screen.getAllByText("11%");
    expect(copies).toHaveLength(2);
    expect(copies.filter((node) => node.getAttribute("aria-hidden") === "true")).toHaveLength(1);
  });

  it("isNonEmpty narrows lists", () => {
    expect(isNonEmpty([])).toBe(false);
    expect(isNonEmpty(undefined)).toBe(false);
    expect(isNonEmpty([1])).toBe(true);
  });

  it("Testimonial renders nothing without an attribution or a quote", () => {
    expect(
      render(<Testimonial quote="Example quote (fixture)" attribution="" />).container.firstChild,
    ).toBeNull();
    expect(
      render(<Testimonial quote="" attribution="Example Person (fixture)" />).container.firstChild,
    ).toBeNull();
    render(
      <Testimonial
        quote="Example quote (fixture)"
        attribution="Example Person (fixture)"
        role="Example role (fixture)"
      />,
    );
    expect(screen.getByText("Example Person (fixture), Example role (fixture)")).toBeTruthy();
  });

  it("TechnicalFigure renders nothing without a text alternative or without media", () => {
    expect(
      render(
        <TechnicalFigure textAlternative="" image={{ url: url("a.png"), width: 10, height: 10 }} />,
      ).container.firstChild,
    ).toBeNull();
    expect(
      render(<TechnicalFigure textAlternative="Example alternative (fixture)" />).container
        .firstChild,
    ).toBeNull();
  });

  it("TechnicalFigure names an image and an inline diagram by the text alternative", () => {
    const withImage = render(
      <TechnicalFigure
        textAlternative="Example alternative (fixture)"
        image={{ url: url("a.png"), width: 10, height: 10 }}
        caption="Example caption (fixture)"
      />,
    );
    expect(screen.getByRole("img", { name: "Example alternative (fixture)" })).toBeTruthy();
    expect(screen.getByText("Example caption (fixture)")).toBeTruthy();
    withImage.unmount();
    render(
      <TechnicalFigure textAlternative="Example inline alternative (fixture)">
        <svg />
      </TechnicalFigure>,
    );
    expect(screen.getByRole("img", { name: "Example inline alternative (fixture)" })).toBeTruthy();
  });

  it("ContentGap renders only in draft mode", () => {
    expect(
      render(<ContentGap draft={false} title="Example gap (fixture)" />).container.firstChild,
    ).toBeNull();
    cleanup();
    render(<ContentGap draft title="Example gap (fixture)" description="Example hint (fixture)" />);
    expect(screen.getByText("Example gap (fixture)")).toBeTruthy();
    expect(screen.getByText("Draft only")).toBeTruthy();
  });

  it("RelatedContentRail, EvaluationTable, SubprocessorTable, TableOfContents, ProcessJourney, ResourceLinks render nothing when empty", () => {
    const empties = [
      <RelatedContentRail key="a" heading="Example (fixture)" items={[] as unknown as [never]} />,
      <EvaluationTable
        key="b"
        caption="Example (fixture)"
        dimensionHeading="D"
        columns={["V"]}
        rows={[]}
      />,
      <SubprocessorTable key="c" caption="Example (fixture)" rows={[]} />,
      <TableOfContents key="d" items={[]} />,
      <ProcessJourney key="e" stages={[] as unknown as [never]} />,
      <ResourceLinks key="f" links={[] as unknown as [never]} />,
      <AuthorMeta key="g" />,
      <Figure key="h" />,
      <TerminalCTA key="i" heading="Example (fixture)" primary={undefined} />,
      <EvidenceRequestCTA key="j" heading="Example (fixture)" cta={undefined} />,
      <CodeBlock key="k" code="" />,
    ];
    for (const element of empties) {
      const { container, unmount } = render(element);
      expect(container.firstChild).toBeNull();
      unmount();
    }
  });
});

describe("images are optional and long titles wrap", () => {
  it("cards, features and rows render without any image", () => {
    const { container } = render(
      <div>
        <SolutionCard title={long} href={url("s")} summary="Example summary (fixture)" />
        <LinkCard kind="insight" title={long} href={url("i")} eyebrow="Example kind (fixture)" />
        <CaseStudyFeature
          title={long}
          href={url("c")}
          challenge="Example challenge (fixture)"
          metrics={[stat]}
        />
        <ArticleFeature title={long} href={url("a")} summary="Example summary (fixture)" />
        <PersonCard name="Example Person (fixture)" role="Example role (fixture)" />
        <PersonHero name="Example Person (fixture)" />
      </div>,
    );
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: long })).toHaveLength(4);
  });

  it("renders images when supplied, with their alt text and dimensions", () => {
    const image = { url: url("img.png"), alt: "Example alt (fixture)", width: 120, height: 80 };
    render(<SolutionCard title="Example (fixture)" href={url("s")} image={image} />);
    const img = screen.getByRole("img", { name: "Example alt (fixture)" });
    expect(img.getAttribute("width")).toBe("120");
    expect(img.getAttribute("height")).toBe("80");
  });

  it("decorative images get an empty alt", () => {
    const { container } = render(
      <Figure image={{ url: url("d.png"), alt: "", decorative: true, width: 10, height: 10 }} />,
    );
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("a card has exactly one link and the title is its accessible name", () => {
    const { container } = render(
      <SolutionCard title={long} href={url("s")} summary="Example summary (fixture)" />,
    );
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("h3 a")?.textContent).toBe(long);
  });

  it("rows keep the heading level configurable", () => {
    render(<PracticeRow title="Example (fixture)" href={url("p")} headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: "Example (fixture)" })).toBeTruthy();
  });

  it("rows render summary and labelled meta", () => {
    render(
      <OfferRow
        title="Example offer (fixture)"
        href={url("o")}
        summary="Example summary (fixture)"
        meta={[{ label: "Duration", value: "Example duration (fixture)" }]}
      />,
    );
    expect(screen.getByText("Example duration (fixture)")).toBeTruthy();
    cleanup();
    render(<IndustryRow title="Example industry (fixture)" href={url("i")} />);
    expect(screen.getByRole("link", { name: "Example industry (fixture)" })).toBeTruthy();
  });

  it("PersonCard falls back to a decorative monogram without a portrait", () => {
    const { container } = render(<PersonCard name="Example Person" />);
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe("EP");
  });
});

describe("proof and labs", () => {
  it("CaseStudyFeature shows up to three metrics; CaseStudyRow shows one", () => {
    const { unmount } = render(
      <CaseStudyFeature
        title="Example (fixture)"
        href={url("c")}
        metrics={[stat, stat, stat, stat]}
      />,
    );
    expect(screen.getAllByText(/Source:/)).toHaveLength(3);
    unmount();
    render(<CaseStudyRow title="Example (fixture)" href={url("c")} metrics={[stat, stat]} />);
    expect(screen.getAllByText(/Source:/)).toHaveLength(1);
  });

  it("MaturityBadge states maturity as text for every stage", () => {
    for (const maturity of [
      "research",
      "concept",
      "prototype",
      "accelerator",
      "beta",
      "production-product",
    ] as const) {
      const { container, unmount } = render(
        <MaturityBadge maturity={maturity} label={`Label ${maturity} (fixture)`} />,
      );
      expect(container.textContent).toBe(`Label ${maturity} (fixture)`);
      expect(container.firstElementChild?.getAttribute("data-maturity")).toBe(maturity);
      unmount();
    }
  });

  it("LabAssetRow puts the maturity text with the title", () => {
    render(
      <LabAssetRow
        title="Example asset (fixture)"
        href={url("l")}
        maturity="beta"
        maturityLabel="Example maturity (fixture)"
        eyebrow="Example type (fixture)"
      />,
    );
    expect(screen.getByText("Example maturity (fixture)")).toBeTruthy();
    expect(screen.getByText("Example type (fixture)")).toBeTruthy();
  });

  it("EvaluationTable renders a table with column headings and a row header", () => {
    render(
      <EvaluationTable
        caption="Example evaluation (fixture)"
        dimensionHeading="Dimension"
        columns={["Target", "Measured"]}
        rows={[{ dimension: "Example dimension (fixture)", values: ["T", "M"] }]}
      />,
    );
    expect(screen.getByRole("table", { name: "Example evaluation (fixture)" })).toBeTruthy();
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getByRole("rowheader", { name: "Example dimension (fixture)" })).toBeTruthy();
  });

  it("ResourceLinks lists links with optional descriptions", () => {
    render(
      <ResourceLinks
        heading="Example resources (fixture)"
        links={[
          {
            label: "Example link (fixture)",
            href: url("r"),
            description: "Example format (fixture)",
            external: true,
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Example link (fixture)" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Example resources (fixture)" })).toBeTruthy();
  });
});

describe("trust", () => {
  it("CertificationItem needs a scope and renders dates as time elements", () => {
    expect(
      render(<CertificationItem name="Example (fixture)" scope="" issuedAt="2026-01-31" />)
        .container.firstChild,
    ).toBeNull();
    cleanup();
    const { container } = render(
      <CertificationItem
        name="Example certification (fixture)"
        scope="Example scope (fixture)"
        issuedAt="2026-01-31"
        expiresAt="2027-01-30"
        link={{ label: "Example evidence (fixture)", href: url("cert") }}
      />,
    );
    const times = container.querySelectorAll("time");
    expect(times).toHaveLength(2);
    expect(times[0]?.getAttribute("datetime")).toBe("2026-01-31");
    expect(times[0]?.textContent).toBe("31 January 2026");
    expect(screen.getByRole("link", { name: /Example evidence/ })).toBeTruthy();
  });

  it("PolicySummary renders the last review date only when given", () => {
    const { container, unmount } = render(
      <PolicySummary title="Example (fixture)" summary="Example position (fixture)" />,
    );
    expect(container.querySelector("time")).toBeNull();
    unmount();
    const second = render(
      <PolicySummary
        title="Example (fixture)"
        summary="Example position (fixture)"
        lastReviewed="2026-02-01"
      />,
    );
    expect(second.container.querySelector("time")?.getAttribute("datetime")).toBe("2026-02-01");
  });

  it("TrustTopicRow shows the status as text", () => {
    render(
      <TrustTopicRow
        title="Example topic (fixture)"
        href={url("t")}
        status="Example status (fixture)"
      />,
    );
    expect(screen.getByText("Example status (fixture)")).toBeTruthy();
  });

  it("EvidenceRequestCTA links to the supplied route", () => {
    render(
      <EvidenceRequestCTA
        heading="Example request (fixture)"
        cta={{ label: "Example ask (fixture)", href: url("contact?intent=procurement") }}
      />,
    );
    expect(screen.getByRole("link", { name: "Example ask (fixture)" }).getAttribute("href")).toBe(
      url("contact?intent=procurement"),
    );
  });

  it("SubprocessorTable omits the location column when no row has one", () => {
    const { unmount } = render(
      <SubprocessorTable
        caption="Example (fixture)"
        rows={[{ name: "Example provider (fixture)", purpose: "Example purpose (fixture)" }]}
      />,
    );
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    unmount();
    render(
      <SubprocessorTable
        caption="Example (fixture)"
        rows={[
          {
            name: "Example provider (fixture)",
            purpose: "Example purpose (fixture)",
            location: "Example place (fixture)",
          },
        ]}
      />,
    );
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });
});

describe("insights, journey and footer", () => {
  it("AuthorMeta shows singular/plural labels and hides an unchanged update date", () => {
    const { container } = render(
      <AuthorMeta
        authors={[
          { name: "Example One (fixture)", href: url("a1") },
          { name: "Example Two (fixture)" },
        ]}
        publishedAt="2026-03-01"
        updatedAt="2026-03-01"
        readTime="Example read time (fixture)"
      />,
    );
    expect(screen.getByText("Authors:")).toBeTruthy();
    expect(screen.queryByText("Updated:")).toBeNull();
    expect(container.querySelectorAll("time")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Example One (fixture)" })).toBeTruthy();
  });

  it("ArticleRow does not nest author links inside the row link", () => {
    const { container } = render(
      <ArticleRow
        title="Example article (fixture)"
        href={url("art")}
        authors={[{ name: "Example One (fixture)", href: url("a1") }]}
        publishedAt="2026-03-01"
      />,
    );
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(screen.getByText("Example One (fixture)")).toBeTruthy();
  });

  it("TableOfContents marks the current heading and indents level 3", () => {
    render(
      <TableOfContents
        items={[
          { id: "one", label: "One (fixture)" },
          { id: "two", label: "Two (fixture)", level: 3 },
        ]}
        currentId="two"
      />,
    );
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Two (fixture)" }).getAttribute("aria-current")).toBe(
      "location",
    );
    expect(screen.getByRole("link", { name: "One (fixture)" }).getAttribute("href")).toBe("#one");
  });

  it("ProcessJourney is an ordered list of stages with optional parts", () => {
    render(
      <ProcessJourney
        aria-label="Example journey (fixture)"
        stages={[
          {
            title: "Example stage one (fixture)",
            deliverables: ["Example deliverable (fixture)"],
            decisionGate: "Example gate (fixture)",
          },
          { title: "Example stage two (fixture)" },
        ]}
      />,
    );
    expect(screen.getByRole("list", { name: "Example journey (fixture)" }).tagName).toBe("OL");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.getByText("Example deliverable (fixture)")).toBeTruthy();
    expect(screen.getByText(/Example gate \(fixture\)/)).toBeTruthy();
  });

  it("SiteFooter omits empty columns and empty contact or identity blocks", () => {
    const { container } = render(
      <SiteFooter
        columns={[
          {
            key: "a",
            heading: "Example column (fixture)",
            links: [{ label: "Example link (fixture)", href: url("l") }],
          },
          { key: "b", heading: "Example empty column (fixture)", links: [] },
        ]}
        contact={{ heading: "Example contact (fixture)" }}
        legalIdentity={{ lines: ["", "  "] }}
      />,
    );
    expect(screen.queryByText("Example empty column (fixture)")).toBeNull();
    expect(screen.queryByText("Example contact (fixture)")).toBeNull();
    expect(container.querySelectorAll("footer h2")).toHaveLength(1);
  });

  it("SiteFooter renders brand, contact and legal identity from props only", () => {
    render(
      <SiteFooter
        brand={{
          descriptor: "Example descriptor (fixture)",
          proposition: "Example proposition (fixture)",
          wordmarkText: "Example brand (fixture)",
        }}
        columns={[]}
        contact={{
          heading: "Example contact (fixture)",
          email: "hello@example.invalid",
          social: [{ label: "Example social (fixture)", href: url("s") }],
        }}
        legalIdentity={{
          heading: "Example identity (fixture)",
          lines: ["Example company (fixture)"],
        }}
      />,
    );
    expect(screen.getByText("Example descriptor (fixture)")).toBeTruthy();
    expect(screen.getByRole("link", { name: "hello@example.invalid" }).getAttribute("href")).toBe(
      "mailto:hello@example.invalid",
    );
    expect(screen.getByText("Example company (fixture)")).toBeTruthy();
  });

  it("TerminalCTA renders its action and optional secondary link", () => {
    render(
      <TerminalCTA
        heading="Example closing heading (fixture)"
        primary={{ label: "Example primary (fixture)", href: url("p") }}
        secondary={{ label: "Example secondary (fixture)", href: url("s") }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Example closing heading (fixture)" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Example primary (fixture)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Example secondary (fixture)" })).toBeTruthy();
  });
});

describe("CodeBlock", () => {
  it("renders code in a labelled, focusable region and no copy button without a clipboard", () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    render(<CodeBlock code={"const a = 1;"} language="ts" />);
    const region = screen.getByRole("region", { name: "ts code" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.textContent).toBe("const a = 1;");
    expect(screen.queryByRole("button")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("copies the code and announces it when the Clipboard API exists", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(
      <CodeBlock
        code={"const a = 1;"}
        copyLabel="Copy example (fixture)"
        copiedLabel="Copied example (fixture)"
      />,
    );
    const button = await screen.findByRole("button", { name: "Copy example (fixture)" });
    fireEvent.click(button);
    expect(writeText).toHaveBeenCalledWith("const a = 1;");
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Copied example (fixture)"),
    );
    vi.unstubAllGlobals();
  });
});

describe("no hard-coded marketing copy", () => {
  it("never emits locked marketing strings by itself", () => {
    const { container } = render(
      <div>
        <SiteFooter columns={[]} />
        <TerminalCTA
          heading="Example (fixture)"
          primary={{ label: "Example (fixture)", href: url("x") }}
        />
      </div>,
    );
    expect(container.textContent).not.toMatch(
      /Talk to Vitalos|Explore what we do|Technology Consulting/,
    );
  });
});
