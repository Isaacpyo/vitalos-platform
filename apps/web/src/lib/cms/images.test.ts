import { describe, expect, it } from "vitest";
import { classifyImageUrl, sanityImageUrl } from "./images";

describe("classifyImageUrl", () => {
  it("accepts Sanity CDN images and same-origin paths", () => {
    expect(classifyImageUrl("https://cdn.sanity.io/images/p/d/abc-800x600.jpg")).toBe("sanity");
    expect(classifyImageUrl("/images/example.png")).toBe("local");
  });

  it("refuses everything the CSP would block or that could be abused", () => {
    for (const url of [
      "http://cdn.sanity.io/images/p/d/a.jpg",
      "https://example.invalid/a.jpg",
      "https://cdn.sanity.io.evil.invalid/a.jpg",
      "https://user:pass@cdn.sanity.io/a.jpg",
      "https://cdn.sanity.io:8443/a.jpg",
      "//evil.invalid/a.jpg",
      "/\\evil.invalid/a.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "not a url",
      "",
    ]) {
      expect(classifyImageUrl(url)).toBeNull();
    }
  });
});

describe("classifyImageUrl with a project scope", () => {
  const own = "https://cdn.sanity.io/images/proj1/production/a-800x600.jpg";
  const other = "https://cdn.sanity.io/images/proj2/production/a-800x600.jpg";

  it("accepts only this project's images when a project id is configured", () => {
    expect(classifyImageUrl(own, { projectId: "proj1" })).toBe("sanity");
    expect(classifyImageUrl(other, { projectId: "proj1" })).toBeNull();
    expect(
      classifyImageUrl("https://cdn.sanity.io/files/proj1/x.pdf", { projectId: "proj1" }),
    ).toBeNull();
  });

  it("can also pin the dataset", () => {
    expect(classifyImageUrl(own, { projectId: "proj1", dataset: "production" })).toBe("sanity");
    expect(classifyImageUrl(own, { projectId: "proj1", dataset: "staging" })).toBeNull();
  });

  it("does not restrict without a project id, and never restricts local paths", () => {
    expect(classifyImageUrl(other, {})).toBe("sanity");
    expect(classifyImageUrl("/images/a.png", { projectId: "proj1" })).toBe("local");
  });
});

describe("sanityImageUrl", () => {
  it("adds width, quality and automatic format, preserving the path", () => {
    const url = new URL(sanityImageUrl("https://cdn.sanity.io/images/p/d/a-800x600.jpg", 640, 80));
    expect(url.pathname).toBe("/images/p/d/a-800x600.jpg");
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("80");
    expect(url.searchParams.get("auto")).toBe("format");
    expect(url.searchParams.get("fit")).toBe("max");
  });

  it("clamps nonsense widths and qualities", () => {
    const url = new URL(sanityImageUrl("https://cdn.sanity.io/images/a.jpg?h=900", -5, 500));
    expect(url.searchParams.get("w")).toBe("1");
    expect(url.searchParams.get("q")).toBe("100");
    expect(url.searchParams.has("h")).toBe(false);
  });
});
