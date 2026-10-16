import { describe, expect, it } from "vitest";
import { shareTargets } from "./share";

describe("shareTargets", () => {
  it("builds plain share links for the major networks, encoding the URL and title", () => {
    const url = "https://www.example.test/insights/a?b=1";
    const targets = shareTargets(url, "Example & title (fixture)");
    expect(targets.map((target) => target.key)).toEqual([
      "linkedin",
      "x",
      "facebook",
      "whatsapp",
      "reddit",
      "bluesky",
      "email",
    ]);
    const byKey = Object.fromEntries(targets.map((target) => [target.key, target]));
    expect(byKey.linkedin?.href).toBe(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fwww.example.test%2Finsights%2Fa%3Fb%3D1",
    );
    expect(byKey.x?.href).toBe(
      "https://x.com/intent/post?url=https%3A%2F%2Fwww.example.test%2Finsights%2Fa%3Fb%3D1&text=Example%20%26%20title%20(fixture)",
    );
    expect(byKey.email?.href.startsWith("mailto:?subject=")).toBe(true);
    expect(byKey.email?.newTab).toBe(false);
    for (const target of targets) {
      // Only https share endpoints (or mailto), never a script or an SDK.
      expect(target.href).toMatch(/^(https:\/\/|mailto:\?)/);
    }
  });
});
