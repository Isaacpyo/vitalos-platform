import { describe, expect, it } from "vitest";
describe("foundation", () =>
  it("uses an explicitly artificial domain", () =>
    expect("test@example.invalid").toMatch(/\.invalid$/)));
