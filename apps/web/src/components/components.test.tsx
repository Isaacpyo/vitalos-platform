import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ImageView, RichText as RichTextValue } from "@vitalos/cms";
import { CmsImage } from "./cms-image";
import { JsonLd } from "./json-ld";
import { RichText } from "./rich-text";

const image: ImageView = {
  url: "/images/a-800x600.jpg",
  alt: "A labelled diagram",
  width: 800,
  height: 600,
};

describe("CmsImage", () => {
  it("renders an approved same-origin image with alt text", () => {
    const html = renderToStaticMarkup(<CmsImage image={image} />);
    expect(html).toContain('alt="A labelled diagram"');
    expect(html).toContain("/images/a-800x600.jpg");
    expect(html).toContain('width="800"');
  });

  it("renders nothing without an image", () => {
    expect(renderToStaticMarkup(<CmsImage image={null} />)).toBe("");
    expect(renderToStaticMarkup(<CmsImage image={undefined} />)).toBe("");
  });

  it("renders nothing unless rights are approved", () => {
    for (const rightsStatus of ["pending", "unknown", ""]) {
      const unapproved = { ...image, rightsStatus } as ImageView;
      expect(renderToStaticMarkup(<CmsImage image={unapproved} />)).toBe("");
    }
    const approved = { ...image, rightsStatus: "approved" } as ImageView;
    expect(renderToStaticMarkup(<CmsImage image={approved} />)).toContain("<img");
  });

  it("renders nothing for meaningful images without alt text, but allows decorative ones", () => {
    expect(renderToStaticMarkup(<CmsImage image={{ ...image, alt: "  " }} />)).toBe("");
    const decorative = renderToStaticMarkup(
      <CmsImage image={{ ...image, alt: "", decorative: true }} />,
    );
    expect(decorative).toContain('alt=""');
  });

  it("renders nothing for hosts the CSP would block and for unusable dimensions", () => {
    expect(
      renderToStaticMarkup(<CmsImage image={{ ...image, url: "https://evil.invalid/a.jpg" }} />),
    ).toBe("");
    expect(renderToStaticMarkup(<CmsImage image={{ ...image, width: 0 }} />)).toBe("");
  });
});

describe("JsonLd", () => {
  it("renders nothing for no data", () => {
    expect(renderToStaticMarkup(<JsonLd data={null} />)).toBe("");
    expect(renderToStaticMarkup(<JsonLd data={undefined} />)).toBe("");
    expect(renderToStaticMarkup(<JsonLd data={[null, undefined]} />)).toBe("");
  });

  it("escapes < so content can never close the script element", () => {
    const html = renderToStaticMarkup(
      <JsonLd data={{ "@type": "Thing", name: "</script><script>alert(1)</script>" }} />,
    );
    expect(html).toContain('<script type="application/ld+json">');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).toContain("\\u003c/script>");
    expect(html).not.toContain("<script>alert");
  });

  it("renders several nodes as one JSON array", () => {
    const html = renderToStaticMarkup(<JsonLd data={[{ "@type": "A" }, null, { "@type": "B" }]} />);
    expect(html).toContain('[{"@type":"A"},{"@type":"B"}]');
  });
});

describe("RichText", () => {
  const value: RichTextValue = [
    {
      _type: "block",
      style: "h2",
      children: [{ _type: "span", text: "Heading", marks: [] }],
      markDefs: [],
    },
    {
      _type: "block",
      children: [
        { _type: "span", text: "Hello ", marks: [] },
        { _type: "span", text: "world", marks: ["strong", "l"] },
      ],
      markDefs: [{ _key: "l", _type: "link", href: "https://example.invalid" }],
    },
    {
      _type: "block",
      listItem: "bullet",
      children: [{ _type: "span", text: "item", marks: [] }],
      markDefs: [],
    },
    { _type: "pullQuote", quote: "Quoted", attribution: "Someone" },
    { _type: "codeBlock", code: "a < b", language: "ts" },
  ];

  it("renders semantic HTML", () => {
    const html = renderToStaticMarkup(<RichText value={value} />);
    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain(
      '<a href="https://example.invalid" rel="noopener noreferrer"><strong>world</strong></a>',
    );
    expect(html).toContain("<ul><li>item</li></ul>");
    expect(html).toMatch(/<figcaption[^>]*>Someone<\/figcaption>/);
    expect(html).toMatch(/<blockquote[^>]*>Quoted<\/blockquote>/);
    expect(html).toContain('<pre data-language="ts" tabindex="0"><code>a &lt; b</code></pre>');
  });

  it("renders nothing for empty or missing content and never an h1", () => {
    expect(renderToStaticMarkup(<RichText value={null} />)).toBe("");
    expect(renderToStaticMarkup(<RichText value={[]} />)).toBe("");
    const html = renderToStaticMarkup(
      <RichText
        value={[
          {
            _type: "block",
            style: "h1",
            children: [{ _type: "span", text: "T", marks: [] }],
            markDefs: [],
          },
        ]}
      />,
    );
    expect(html).not.toContain("<h1");
    expect(html).toContain("<h2>T</h2>");
  });

  it("escapes text content", () => {
    const html = renderToStaticMarkup(
      <RichText
        value={[
          {
            _type: "block",
            children: [{ _type: "span", text: "<img src=x onerror=alert(1)>", marks: [] }],
            markDefs: [],
          },
        ]}
      />,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  describe("dataTable", () => {
    const tableValue: RichTextValue = [
      {
        _type: "dataTable",
        _key: "t",
        caption: "Example table (fixture)",
        columns: ["Dimension", "Target"],
        rows: [{ cells: ["Quality", "00"] }, { cells: ["Latency", "00 ms"] }],
      },
    ];

    it("renders a captioned table with column and row headers and stacking labels", () => {
      const html = renderToStaticMarkup(<RichText value={tableValue} />);
      expect(html).toContain("<table");
      expect(html).toMatch(/<caption[^>]*>Example table \(fixture\)<\/caption>/);
      expect(html.match(/<th[^>]*scope="col"/g)).toHaveLength(2);
      expect(html.match(/<th[^>]*scope="row"/g)).toHaveLength(2);
      expect(html).toContain('data-label="Target"');
      expect(html).toContain(">00 ms<");
    });

    it("renders nothing for a table without a caption", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const { caption: _caption, ...noCaption } = tableValue[0] as Record<string, unknown>;
      expect(
        renderToStaticMarkup(<RichText value={[noCaption] as unknown as RichTextValue} />),
      ).toBe("");
      warn.mockRestore();
    });
  });
});
