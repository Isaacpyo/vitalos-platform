import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { describe, expect, it } from "vitest";
import { relayFoundation, relaySemantic, renderRelayCss } from "./relay";

const expected = await format(renderRelayCss(), { parser: "css", printWidth: 100 });
if (process.env.UPDATE_TOKENS === "1")
  writeFileSync(new URL("./relay.css", import.meta.url), expected);

const brand = JSON.parse(
  readFileSync(new URL("../../../docs/relay/reference/brand/tokens.json", import.meta.url), "utf8"),
) as { color: { tokens: { name: string; value: string | { light: string; dark: string } }[] } };

const kebab = (k: string) =>
  k
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-z])([0-9])/g, "$1-$2")
    .toLowerCase();

describe("Relay brand v2 tokens", () => {
  it("relay.css matches the generated output", () => {
    expect(readFileSync(new URL("./relay.css", import.meta.url), "utf8")).toBe(expected);
  });

  it("matches the supplied brand tokens.json exactly", () => {
    const byName = new Map(brand.color.tokens.map((t) => [t.name, t.value]));
    for (const [key, hex] of Object.entries(relayFoundation)) {
      const name = kebab(key);
      expect(byName.get(name), name).toBe(hex);
    }
    for (const [key, roles] of Object.entries(relaySemantic)) {
      const value = byName.get(kebab(key)) as { light: string; dark: string };
      expect(value, key).toEqual({
        light: relayFoundation[roles.light],
        dark: relayFoundation[roles.dark],
      });
    }
  });
});
