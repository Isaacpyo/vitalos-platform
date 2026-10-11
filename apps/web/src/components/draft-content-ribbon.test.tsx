import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftContentRibbon, HIDE_WHILE_MENU_OPEN, draftRibbonText } from "./draft-content-ribbon";

describe("DraftContentRibbon", () => {
  it("renders a labelled, server-rendered notice for the draft source", () => {
    const html = renderToStaticMarkup(<DraftContentRibbon kind="draft" />);
    expect(html).toContain("<aside");
    expect(html).toContain(`aria-label="${draftRibbonText.label}"`);
    expect(html).toContain("Draft content, pending approval.");
    // Visible in the page flow: never fixed or sticky, and hidden only while the compact menu
    // sheet is open (the one CSS variant below).
    const variant = HIDE_WHILE_MENU_OPEN.replaceAll("&", "&amp;");
    expect(html).toContain(variant);
    expect(html.replace(variant, "")).not.toMatch(/hidden|sr-only|fixed|sticky/);
    // Tokens only: no raw colour values.
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });

  it.each(["sanity", "empty", "fixtures"] as const)("renders nothing for %s", (kind) => {
    expect(renderToStaticMarkup(<DraftContentRibbon kind={kind} />)).toBe("");
  });
});
