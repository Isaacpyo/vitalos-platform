import { describe, expect, it } from "vitest";
import { isSafeSiteLink } from "./index";

describe("isSafeSiteLink", () => {
  it("allows same-site paths and https://vitalos.co.uk", () => {
    for (const href of [
      "/",
      "/offers/engineering-rescue",
      "/trust/security#iso",
      "https://vitalos.co.uk",
      "https://www.vitalos.co.uk/trust",
    ])
      expect(isSafeSiteLink(href), href).toBe(true);
  });

  it("rejects other hosts, protocol-relative and backslash tricks, and scripts", () => {
    for (const href of [
      "//evil.example",
      "/\\evil.example",
      "/a\\b",
      "https://evil.example/",
      "https://vitalos.co.uk.evil.example/",
      "http://www.vitalos.co.uk/",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ])
      expect(isSafeSiteLink(href), String(href)).toBe(false);
  });
});
