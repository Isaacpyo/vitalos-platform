import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviewBarView, exitPreviewHref, previewStatusLabel } from "./preview-bar";

describe("PreviewBarView", () => {
  it("shows the mono preview line with the status and an exit link", () => {
    const html = renderToStaticMarkup(
      <PreviewBarView status="in_review" exitHref={exitPreviewHref("/insights/a-post")} />,
    );
    expect(html).toContain('<aside aria-label="Preview" data-tone="dark"');
    expect(html).toContain("PREVIEW · NOT PUBLISHED · IN REVIEW");
    expect(html).toContain('href="/api/content/preview/exit?path=%2Finsights%2Fa-post"');
    expect(html).toContain(">Exit preview</a>");
    expect(html).toContain("fixed");
    // Tokens only: no raw colour values.
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });

  it("omits an unknown status", () => {
    const html = renderToStaticMarkup(<PreviewBarView status={null} exitHref="/x" />);
    expect(html).toContain("PREVIEW · NOT PUBLISHED</p>");
  });

  it("formats status labels", () => {
    expect(previewStatusLabel("draft")).toBe("DRAFT");
    expect(previewStatusLabel("in_review")).toBe("IN REVIEW");
  });
});
