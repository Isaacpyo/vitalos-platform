import { describe, expect, it } from "vitest";
import { isSameOriginImage } from "./images";

describe("isSameOriginImage", () => {
  it("accepts same-origin paths", () => {
    expect(isSameOriginImage("/images/example.png")).toBe(true);
  });

  it("refuses everything the CSP would block or that could be abused", () => {
    for (const url of [
      "https://example.invalid/a.jpg",
      "http://example.invalid/a.jpg",
      "//evil.invalid/a.jpg",
      "/\\evil.invalid/a.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "not a url",
      "",
    ]) {
      expect(isSameOriginImage(url)).toBe(false);
    }
  });
});
