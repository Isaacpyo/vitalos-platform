import { describe, expect, it } from "vitest";
// @ts-expect-error The script is plain ESM JavaScript without type declarations.
import { classify, everything, isIgnored } from "../../tooling/scripts/ci-changes.mjs";

const none = {
  full: false,
  static: false,
  unit: false,
  web: false,
  storybook: false,
  database: false,
};

describe("CI change classifier", () => {
  it("ignores docs, Markdown, the Super Admin and other workflows", () => {
    for (const file of [
      "docs/adr/ADR-021-quality-gates.md",
      "docs/operations/runbook.txt",
      "apps/web/README.md",
      "superadmin/apps/core/views.py",
      ".github/workflows/superadmin.yml",
      ".github/workflows/codeql.yml",
      ".github/dependabot.yml",
    ]) {
      expect(isIgnored(file), file).toBe(true);
    }
  });

  it("keeps docs/strategy, which a CMS unit test reads", () => {
    expect(isIgnored("docs/strategy/stage-10.md")).toBe(false);
    expect(classify(["docs/strategy/stage-10.md"])).toEqual(everything());
  });

  it("runs everything for files outside workspace packages", () => {
    for (const file of [
      "pnpm-lock.yaml",
      "turbo.json",
      "playwright.config.ts",
      "tests/end-to-end/home.spec.ts",
      "tooling/scripts/check-secrets.mjs",
      ".github/workflows/ci.yml",
    ]) {
      expect(classify([file]), file).toEqual(everything());
    }
  });

  it("runs only static checks for editorial content", () => {
    expect(classify(["packages/cms/src/repo/pages.ts"], ["@vitalos/cms", "@vitalos/web"])).toEqual({
      ...none,
      static: true,
    });
  });

  it("follows Turborepo's affected packages for package code", () => {
    expect(
      classify(
        ["packages/ui/src/button.tsx"],
        ["@vitalos/ui", "@vitalos/web", "@vitalos/storybook"],
      ),
    ).toEqual({
      ...none,
      static: true,
      unit: true,
      web: true,
      storybook: true,
    });
    expect(
      classify(["packages/email-layout/src/render.ts"], ["@vitalos/email-layout", "@vitalos/web"]),
    ).toEqual({
      ...none,
      static: true,
      unit: true,
      web: true,
    });
  });

  it("runs pgTAP only for database changes", () => {
    expect(classify(["supabase/migrations/0001_init.sql"])).toEqual({ ...none, database: true });
  });

  it("returns nothing to run when every file is ignored", () => {
    expect(classify(["docs/x.md", "superadmin/manage.py"])).toEqual(none);
  });
});
