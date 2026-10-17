import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { RenderResponse } from "../schemas";
import { imageDimensions, isAllowedImage, renderMarkdown } from "./render";
import type { RenderOptions } from "./render";

const media = "https://media.example.test";
const post: RenderOptions = { context: "post", mediaOrigin: media };
const render = (markdown: string, options: RenderOptions = post) =>
  renderMarkdown(markdown, options);
// Shiki's first load is slow on a busy test machine; warm it once with a generous timeout.
beforeAll(async () => {
  await renderMarkdown("```ts\nconst a = 1;\n```\n\n```html\n<b></b>\n```", { context: "post" });
}, 60_000);

const codes = (result: { warnings: { code: string }[] }) => result.warnings.map((w) => w.code);

/** Attributes the renderer may emit, per element. Anything else in the output is a failure. */
const allowedAttributes: Record<string, string[]> = {
  a: [
    "href",
    "rel",
    "id",
    "aria-label",
    "aria-describedby",
    "data-footnote-ref",
    "data-footnote-backref",
    "class",
  ],
  img: ["src", "alt", "width", "height", "loading", "decoding"],
  div: ["class", "role", "aria-label", "tabindex"],
  pre: ["class", "tabindex", "data-language"],
  code: [],
  span: ["style", "class"],
  h2: ["id", "class"],
  h3: ["id"],
  h4: ["id"],
  li: ["id"],
  ol: ["start"],
  section: ["data-footnotes", "class"],
  td: ["align"],
  th: ["align"],
  p: ["class"],
};

function assertSafe(html: string): void {
  const lower = html.toLowerCase();
  for (const forbidden of [
    "<script",
    "<iframe",
    "<svg",
    "<style",
    "<object",
    "<embed",
    "<form",
    "<input",
    "<math",
    "<base",
    "<meta",
    "<link",
  ]) {
    expect(lower, `${forbidden} in ${html}`).not.toContain(forbidden);
  }
  // Text such as "javascript:alert(1)" may survive as escaped text; it must never be markup.
  // Every attribute of every tag is checked against the allowlist below (so no `on*` handler),
  // and URLs only ever use http(s), mailto, fragments or relative paths.
  for (const match of html.matchAll(/<([a-z0-9]+)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*\/?>/gi)) {
    const tag = (match[1] as string).toLowerCase();
    const attributes = [...(match[2] ?? "").matchAll(/\s([^\s=>]+)(?:="([^"]*)")?/g)];
    for (const [, name, value] of attributes) {
      expect(allowedAttributes[tag] ?? [], `${tag}[${name}] in ${html}`).toContain(name);
      if (name === "style") {
        // Shiki token styles only: a colour and optional font style or weight.
        expect(value).toMatch(
          /^(?:(?:color:#[0-9A-Fa-f]{3,8}|font-style:italic|font-weight:bold|text-decoration:underline);?)+$/, // raw-colour-ok
        );
      }
      if (name === "class" && tag === "span") expect(value).toBe("line");
      if (name === "href" || name === "src") {
        expect(value, `${name}=${value}`).toMatch(
          /^(https?:|mailto:|#|\/(?!\/)|[a-z0-9.-]+(?:\/|$))/i,
        );
      }
    }
  }
}

describe("renderMarkdown: XSS corpus", () => {
  const corpus: [string, string][] = [
    ["script tag", "<script>alert(1)</script>"],
    ["script inline", "Hello <script>alert(1)</script> world"],
    ["javascript link", "[click](javascript:alert(1))"],
    ["javascript link, mixed case and whitespace", "[click](  JaVaScRiPt:alert(1))"],
    ["javascript via entities", "[click](&#106;avascript:alert(1))"],
    ["javascript via percent and tab", "[click](java\tscript:alert(1))"],
    ["vbscript link", "[click](vbscript:msgbox(1))"],
    ["data link", "[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)"],
    ["event handler on raw img", '<img src="x" onerror="alert(1)">'],
    ["event handler on raw a", '<a href="https://example.test" onclick="alert(1)">x</a>'],
    ["data image", "![x](data:image/png;base64,iVBORw0KGgo=)"],
    ["svg image on the media host", `![x](${media}/content/evil.svg)`],
    ["svg image with query", `![x](${media}/content/evil.SVG?x=1)`],
    ["inline svg", '<svg onload="alert(1)"><circle r="1"/></svg>'],
    ["iframe", '<iframe src="https://example.test"></iframe>'],
    ["object and embed", '<object data="x"></object><embed src="x">'],
    ["style tag", "<style>body{display:none}</style>"],
    ["form and input", '<form action="https://example.test"><input name="x"></form>'],
    ["autolink javascript", "<javascript:alert(1)>"],
    ["autolink data", "<data:text/html,alert(1)>"],
    ["reference link to javascript", "[x][r]\n\n[r]: javascript:alert(1)"],
    ["reference image to data", "![x][r]\n\n[r]: data:image/png;base64,AAAA"],
    ["nested markdown in html", '<div markdown="1">[x](javascript:alert(1))</div>'],
    ["link text with html", "[<img src=x onerror=alert(1)>](https://example.test)"],
    ["html in heading", "## <img src=x onerror=alert(1)> Title"],
    ["html in table", "| a |\n| - |\n| <script>alert(1)</script> |"],
    ["html in footnote", "Text[^1]\n\n[^1]: <script>alert(1)</script>"],
    ["malformed footnote label", "Text[^<script>]\n\n[^<script>]: x"],
    ["undefined footnote", "Text[^missing]"],
    ["footnote id clobbering", "Text[^__proto__]\n\n[^__proto__]: x"],
    ["entities", "&lt;script&gt;alert(1)&lt;/script&gt; &#x3C;img src=x onerror=alert(1)&#x3E;"],
    ["html comment", "<!-- <script>alert(1)</script> -->"],
    ["meta refresh", '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">'],
    ["base tag", '<base href="https://evil.example/">'],
    ["image off the media host", "![x](https://evil.example/a.png)"],
    ["protocol-relative image", "![x](//evil.example/a.png)"],
    ["image with credentials", `![x](https://user:pass@media.example.test/a.png)`],
    ["code block with html", "```html\n<script>alert(1)</script>\n```"],
    ["code fence with hostile language", '```js" onmouseover="alert(1)\nx\n```'],
    ["math tag", "<math><mtext><img src=x onerror=alert(1)></mtext></math>"],
  ];

  it.each(corpus)("%s", async (_label, markdown) => {
    for (const context of ["post", "role", "author", "settings"] as const) {
      const result = await render(markdown, { ...post, context });
      assertSafe(result.html);
      expect(RenderResponse.safeParse(result).success).toBe(true);
    }
  });

  it("escapes HTML inside code instead of rendering it", async () => {
    const { html } = await render("```\n<script>alert(1)</script>\n```");
    expect(html).toContain("&#x3C;script>");
    const inline = await render("Use `<b>` tags");
    expect(inline.html).toContain("<code>&#x3C;b></code>");
  });

  it("warns that raw HTML was stripped and keeps the surrounding text", async () => {
    const result = await render("Hello <b>bold</b> world");
    expect(result.html).toBe("<p>Hello bold world</p>");
    expect(result.warnings).toContainEqual({
      code: "html_stripped",
      message: expect.any(String),
      blocking: false,
    });
  });
});

describe("renderMarkdown: FAQ", () => {
  const body = [
    "Intro paragraph.",
    "## Frequently asked questions",
    "### How many companies have deployed AI agents?",
    "Gartner found **17%** have, with [more planning](https://example.test/a) to.",
    "### Why do projects fail?",
    "Costs grow.",
    "",
    "- Scope is too broad.",
    "### A question without an answer?",
    "## Sources",
    "1. [A source](https://example.test/source)",
    "### Not a question",
    "Outside the section.",
  ].join("\n\n");

  it("reads the h3 questions and their answers as plain text, up to the next h2", async () => {
    const result = await render(body);
    expect(result.faq).toEqual([
      {
        question: "How many companies have deployed AI agents?",
        answer: "Gartner found 17% have, with more planning to.",
      },
      { question: "Why do projects fail?", answer: "Costs grow. Scope is too broad." },
    ]);
    expect(RenderResponse.parse(result).faq).toHaveLength(2);
  });

  it("is empty without the heading, and outside the post context", async () => {
    expect((await render("## Questions\n\n### Is this one?\n\nNo.")).faq).toEqual([]);
    expect((await render(body, { context: "role" })).faq).toEqual([]);
  });
});

describe("renderMarkdown: features", () => {
  it("matches the contract's render fixture HTML", async () => {
    const request = JSON.parse(
      readFileSync(
        new URL(
          "../../../../../../contracts/content-api/v1/fixtures/render-request.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { markdown: string };
    const result = await render(request.markdown);
    expect(result.html).toBe(
      '<h2 id="example-heading">Example heading</h2>\n<p>Example paragraph.</p>',
    );
    expect(result.toc).toEqual([{ id: "example-heading", text: "Example heading", depth: 2 }]);
    expect(result.footnotes).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(result.faq).toEqual([]);
  });

  it("gives headings stable, de-duplicated ids and builds a TOC from h2 to h4", async () => {
    const result = await render(
      "## Intro\n\n### Detail\n\n#### Deep\n\n## Intro\n\n## Café & “quotes”!",
    );
    expect(result.toc).toEqual([
      { id: "intro", text: "Intro", depth: 2 },
      { id: "detail", text: "Detail", depth: 3 },
      { id: "deep", text: "Deep", depth: 4 },
      { id: "intro-1", text: "Intro", depth: 2 },
      { id: "café--quotes", text: "Café & “quotes”!", depth: 2 },
    ]);
    expect(result.html).toContain('<h2 id="intro-1">Intro</h2>');
  });

  it("demotes an h1 with a blocking warning, and warns about skipped and deep levels", async () => {
    const result = await render("# Title\n\n#### Skipped\n\n###### Deep");
    expect(result.html).toContain('<h2 id="title">Title</h2>');
    expect(result.html).toContain('<h4 id="deep">Deep</h4>');
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "h1_in_body", blocking: true }),
    );
    expect(codes(result).filter((code) => code === "heading_level").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(result.warnings.find((w) => w.code === "heading_level")?.blocking).toBe(false);
  });

  it("renders NOTE and WARNING callouts", async () => {
    const note = await render("> [!NOTE]\n> Useful information.");
    expect(note.html).toBe(
      '<div class="callout callout-note" role="note"><p class="callout-title">Note</p>\n<p>Useful information.</p>\n</div>',
    );
    const warning = await render("> [!WARNING]\n>\n> Careful now.");
    expect(warning.html).toContain('<div class="callout callout-warning" role="note">');
    expect(warning.html).toContain('<p class="callout-title">Warning</p>');
    expect(warning.html).toContain("<p>Careful now.</p>");
    const quote = await render("> Just a quote.");
    expect(quote.html).toBe("<blockquote>\n<p>Just a quote.</p>\n</blockquote>");
  });

  it("wraps tables in a labelled, focusable region", async () => {
    const { html } = await render("| A | B |\n| :- | -: |\n| 1 | 2 |");
    expect(html).toMatch(
      /^<div class="table-scroll" role="region" aria-label="Table" tabindex="0"><table>/,
    );
    expect(html).toContain('<th align="left">A</th>');
  });

  it("renders media-host images lazily, with a figure and caption when standalone", async () => {
    const result = await render(`![A chart](${media}/content/a.png "Figure 1. A chart.")`);
    expect(result.html).toBe(
      `<figure><img src="${media}/content/a.png" alt="A chart" loading="lazy" decoding="async"><figcaption>Figure 1. A chart.</figcaption></figure>`,
    );
    const inline = await render(`Text ![Icon](${media}/i.png "t") more`);
    expect(inline.html).toBe(
      `<p>Text <img src="${media}/i.png" alt="Icon" loading="lazy" decoding="async"> more</p>`,
    );
    expect(inline.warnings).toEqual([]);
  });

  it("requires alt text (blocking) and drops off-host images (blocking)", async () => {
    const noAlt = await render(`![](${media}/a.png)`);
    expect(noAlt.warnings).toEqual([
      { code: "missing_alt", message: "Image 1 has no alt text.", blocking: true },
    ]);
    const offHost = await render("Before ![x](https://elsewhere.example/a.png) after");
    expect(offHost.html).toBe("<p>Before  after</p>");
    expect(offHost.warnings[0]).toMatchObject({ code: "image_host", blocking: true });
    const noHost = await render(`![x](${media}/a.png)`, { context: "post" });
    expect(noHost.html).toBe("");
    expect(codes(noHost)).toEqual(["image_host"]);
  });

  it("allows no images outside posts", async () => {
    for (const context of ["role", "author", "settings"] as const) {
      const result = await render(`![x](${media}/a.png)`, { context, mediaOrigin: media });
      expect(result.html).toBe("");
      expect(codes(result)).toEqual(["image_host"]);
    }
  });

  it("keeps internal links plain and gives external links rel, all in the same tab", async () => {
    const { html } = await render(
      [
        "[contact](/contact)",
        "[anchor](#intro)",
        "[site](https://www.vitalos.co.uk/insights)",
        "[apex](https://vitalos.co.uk/)",
        "[ext](https://example.test/page)",
        "[proto](//example.test/x)",
        "[mail](mailto:hello@example.test)",
        "<https://example.test/auto>",
      ].join("\n\n"),
    );
    expect(html).toContain('<a href="/contact">contact</a>');
    expect(html).toContain('<a href="#intro">anchor</a>');
    expect(html).toContain('<a href="https://www.vitalos.co.uk/insights">site</a>');
    expect(html).toContain('<a href="https://vitalos.co.uk/">apex</a>');
    expect(html).toContain('<a href="https://example.test/page" rel="noopener noreferrer">ext</a>');
    expect(html).toContain('<a href="//example.test/x" rel="noopener noreferrer">proto</a>');
    expect(html).toContain('<a href="mailto:hello@example.test">mail</a>');
    expect(html).toContain('rel="noopener noreferrer">https://example.test/auto</a>');
    expect(html).not.toContain("target=");
  });

  it("unwraps a link whose URL was refused, keeping its text", async () => {
    expect((await render("[click me](javascript:alert(1))")).html).toBe("<p>click me</p>");
  });

  it("renders footnotes as a Sources list and counts them", async () => {
    const result = await render(
      "One[^a] and two[^b].\n\n[^a]: First source.\n[^b]: Second source.",
    );
    expect(result.footnotes).toBe(2);
    expect(result.html).toContain('<section data-footnotes class="footnotes">');
    expect(result.html).toContain('<h2 class="footnotes-label" id="footnote-label">Sources</h2>');
    expect(result.html).toContain('<li id="user-content-fn-a">');
    expect(result.toc).toEqual([]);
  });

  it("never lets a heading take a footnote id", async () => {
    const result = await render("## Footnote label\n\nText[^1]\n\n[^1]: Source.");
    expect(result.toc[0]?.id).toBe("footnote-label-1");
  });

  it("highlights known languages on the server, with no client script", async () => {
    const { html } = await render("```ts\nconst answer: number = 42;\n```");
    expect(html).toMatch(/^<pre class="code-block" tabindex="0" data-language="typescript"><code>/);
    expect(html).toMatch(/<span style="color:#[0-9A-Fa-f]{6}">const<\/span>/); // raw-colour-ok
    expect(html).not.toContain("background-color");
    expect(html).not.toContain("<script");
  });

  it("leaves unknown languages and non-post contexts as plain escaped code", async () => {
    const unknown = await render("```brainfuck\n+++.\n```");
    expect(unknown.html).toBe('<pre class="code-block" tabindex="0"><code>+++.\n</code></pre>');
    const role = await render("```ts\nconst x = 1;\n```", { context: "role" });
    expect(role.html).toBe(
      '<pre class="code-block" tabindex="0"><code>const x = 1;\n</code></pre>',
    );
  });

  it("returns a body the contract accepts", async () => {
    const result = await render(
      `# H1\n\n## Section\n\n> [!NOTE]\n> n\n\n| a |\n| - |\n| 1 |\n\n![](${media}/x.png)\n\nT[^1]\n\n[^1]: s`,
    );
    expect(RenderResponse.safeParse(result).success).toBe(true);
  });
});

describe("isAllowedImage", () => {
  it("allows only the media origin, never SVG, credentials or other schemes", () => {
    expect(isAllowedImage(`${media}/a.png`, media)).toBe(true);
    expect(isAllowedImage(`${media}/a.svg`, media)).toBe(false);
    expect(isAllowedImage("http://media.example.test/a.png", media)).toBe(false);
    expect(isAllowedImage("https://media.example.test.evil.example/a.png", media)).toBe(false);
    expect(isAllowedImage("/a.png", media)).toBe(false);
    expect(isAllowedImage(`${media}/a.png`, undefined)).toBe(false);
  });
});

describe("image dimensions from the upload fragment", () => {
  it("emits width and height and strips the fragment", async () => {
    const result = await render(`![A chart](${media}/content/a.jpg#w=1600&h=900 "Caption.")`);
    expect(result.html).toBe(
      `<figure><img src="${media}/content/a.jpg" alt="A chart" width="1600" height="900" loading="lazy" decoding="async"><figcaption>Caption.</figcaption></figure>`,
    );
    expect(result.warnings).toEqual([]);
  });

  it("ignores invalid or partial dimensions but still strips the fragment", async () => {
    for (const fragment of [
      "#w=0&h=900",
      "#w=1600",
      "#w=20000&h=10",
      "#w=1.5&h=2",
      "#w=abc&h=1",
      "#x",
    ]) {
      const { html } = await render(`![A](${media}/a.jpg${fragment})`);
      expect(html, fragment).toBe(
        `<figure><img src="${media}/a.jpg" alt="A" loading="lazy" decoding="async"></figure>`,
      );
    }
  });

  it("keeps the current behaviour without a fragment", () => {
    expect(imageDimensions(`${media}/a.jpg`)).toEqual({ src: `${media}/a.jpg` });
    expect(imageDimensions(`${media}/a.jpg#h=10&w=20`)).toEqual({
      src: `${media}/a.jpg`,
      width: 20,
      height: 10,
    });
    expect(imageDimensions(`${media}/a.jpg#w=10000&h=10000`)).toMatchObject({ width: 10000 });
  });
});
