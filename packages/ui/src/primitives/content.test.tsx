import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Callout } from "./Callout";
import { DefinitionList } from "./DefinitionList";
import { Display } from "./Display";
import { Heading } from "./Heading";
import { Icon } from "./Icon";
import { MetaRow } from "./MetaRow";
import { Quote } from "./Quote";
import { Section } from "./Section";
import { Stat } from "./Stat";
import { StatusMessage } from "./StatusMessage";
import { Wordmark } from "./Wordmark";

afterEach(cleanup);

describe("Stat", () => {
  it("renders the figure, descriptor and source", () => {
    render(
      <Stat value="00%" descriptor="Example measure (fixture)" source="Example source (fixture)" />,
    );
    expect(screen.getByText("00%")).toBeTruthy();
    expect(screen.getByText("Example measure (fixture)")).toBeTruthy();
    expect(screen.getByText("Example source (fixture)")).toBeTruthy();
  });

  it("renders nothing without a source (no vanity counters)", () => {
    const { container: missing } = render(
      // @ts-expect-error source is required
      <Stat value="00%" descriptor="Example measure (fixture)" />,
    );
    expect(missing.firstChild).toBeNull();
    const { container: blank } = render(
      <Stat value="00%" descriptor="Example measure (fixture)" source="   " />,
    );
    expect(blank.firstChild).toBeNull();
  });
});

describe("Quote", () => {
  it("renders a figure with blockquote and attribution", () => {
    render(<Quote attribution="Example Person (fixture)">Example words (fixture)</Quote>);
    expect(screen.getByRole("figure")).toBeTruthy();
    expect(screen.getByText("Example words (fixture)").closest("blockquote")).not.toBeNull();
    expect(screen.getByText("Example Person (fixture)").tagName).toBe("FIGCAPTION");
  });

  it("renders nothing without attribution", () => {
    // @ts-expect-error attribution is required
    const { container } = render(<Quote>Example words (fixture)</Quote>);
    expect(container.firstChild).toBeNull();
  });
});

describe("Heading and Display", () => {
  it("keeps the semantic level independent of the visual size", () => {
    render(
      <Heading level={2} size="h1">
        Example heading (fixture)
      </Heading>,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "Example heading (fixture)" });
    expect(heading.className).toContain("text-h1");
  });

  it("defaults the visual size from the level", () => {
    render(<Heading level={3}>Example heading (fixture)</Heading>);
    expect(screen.getByRole("heading", { level: 3 }).className).toContain("text-h3");
  });

  it("renders Display as h1 by default and allows a non-heading element", () => {
    const { rerender } = render(<Display size="xl">Example display (fixture)</Display>);
    expect(screen.getByRole("heading", { level: 1 }).className).toContain("text-display-xl");
    rerender(<Display as="p">Example display (fixture)</Display>);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("Section", () => {
  it("scopes the tone and spacing", () => {
    render(
      <Section tone="dark" spacing="large" aria-label="Example section (fixture)">
        content
      </Section>,
    );
    const section = screen.getByRole("region", { name: "Example section (fixture)" });
    expect(section.getAttribute("data-tone")).toBe("dark");
    expect(section.className).toContain("py-(--section-large)");
  });

  it("defaults to the light tone", () => {
    render(<Section as="div">content</Section>);
    expect(screen.getByText("content").getAttribute("data-tone")).toBe("light");
  });
});

describe("Wordmark", () => {
  it("falls back to VITALOS text when no logo export is supplied", () => {
    render(<Wordmark />);
    expect(screen.getByText("VITALOS")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders the typed logo slot with dimensions when supplied", () => {
    render(<Wordmark logo={{ src: "/example-logo.svg", width: 120, height: 24 }} />);
    const img = screen.getByRole("img", { name: "VITALOS" });
    expect(img.getAttribute("width")).toBe("120");
    expect(img.getAttribute("height")).toBe("24");
  });

  it("constrains a large logo export to a 32px high, width-auto, capped slot", () => {
    render(<Wordmark logo={{ src: "/logo.png", width: 2172, height: 724 }} />);
    const classes = screen.getByRole("img", { name: "VITALOS" }).className.split(" ");
    expect(classes).toEqual(expect.arrayContaining(["h-8", "w-auto", "max-w-48"]));
    expect(classes).not.toContain("h-auto");
  });

  it("links home with a plain anchor when href is given", () => {
    render(<Wordmark href="/" />);
    const link = screen.getByRole("link", { name: "VITALOS" });
    expect(link.tagName).toBe("A");
  });
});

describe("small content primitives", () => {
  it("MetaRow renders labelled items and hides labels visually when asked", () => {
    render(
      <MetaRow
        items={[
          { label: "Author", value: "Example Author (fixture)" },
          { label: "Published", value: "Example date (fixture)", hideLabel: true },
        ]}
      />,
    );
    expect(screen.getByText("Author:")).toBeTruthy();
    expect(screen.getByText("Published").className).toContain("sr-only");
  });

  it("DefinitionList uses native dl semantics", () => {
    const { container } = render(
      <DefinitionList
        items={[{ term: "Example term (fixture)", description: "Example description (fixture)" }]}
      />,
    );
    expect(container.querySelector("dl dt")?.textContent).toBe("Example term (fixture)");
    expect(container.querySelector("dl dd")?.textContent).toBe("Example description (fixture)");
  });

  it("Callout is a note, not a landmark", () => {
    render(<Callout title="Example title (fixture)">Example body (fixture)</Callout>);
    expect(screen.getByRole("note")).toBeTruthy();
  });

  it("StatusMessage is a polite live region with an icon and a text label", () => {
    render(
      <StatusMessage variant="success" title="Example title (fixture)">
        Example body (fixture)
      </StatusMessage>,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Success:");
    expect(status.querySelector("svg")).not.toBeNull();
  });

  it("Icon is decorative unless given a title", () => {
    const { container, rerender } = render(<Icon name="check" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    rerender(<Icon name="check" title="Complete (fixture)" />);
    expect(screen.getByRole("img", { name: "Complete (fixture)" })).toBeTruthy();
  });
});
