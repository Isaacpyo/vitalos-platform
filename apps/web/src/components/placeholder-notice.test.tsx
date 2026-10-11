import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlaceholderNotice, hasPlaceholder, placeholderNoticeText } from "./placeholder-notice";

describe("PlaceholderNotice", () => {
  it("renders a labelled, server-rendered notice with the required wording", () => {
    const html = renderToStaticMarkup(<PlaceholderNotice show />);
    expect(html).toContain("<aside");
    expect(html).toContain(`aria-label="${placeholderNoticeText.label}"`);
    expect(html).toContain("Placeholder — replace before launch");
    expect(html).not.toMatch(/hidden|sr-only|fixed|sticky/);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });

  it("renders nothing when there is no placeholder content", () => {
    expect(renderToStaticMarkup(<PlaceholderNotice show={false} />)).toBe("");
  });
});

describe("hasPlaceholder", () => {
  it("is true when any document or list entry is flagged", () => {
    expect(hasPlaceholder({ placeholder: true })).toBe(true);
    expect(hasPlaceholder([{}, { placeholder: true }])).toBe(true);
    expect(hasPlaceholder({}, [{}], null, undefined)).toBe(false);
    expect(hasPlaceholder()).toBe(false);
  });
});
