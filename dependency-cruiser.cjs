/**
 * Matches an npm package whether dependency-cruiser resolved it into node_modules or left it
 * unresolved (some ESM-only packages stay unresolved but keep their bare module name).
 */
const pkg = (names) => `(^|/)node_modules/(${names})(/|$)|^(${names})(/|$)`;

module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    {
      name: "no-app-to-app",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/", pathNot: "^apps/$1/" },
    },
    {
      name: "no-domain-to-ui",
      severity: "error",
      from: { path: "/(domain|features)/" },
      to: { path: "packages/ui" },
    },
    {
      name: "no-package-to-app",
      comment: "Shared packages must not depend on applications.",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "cms-public-entry-framework-free",
      comment:
        "The @vitalos/cms root entry (routes, navigation, locked copy, content types) must stay free of framework and CMS SDK dependencies so it is safe in web bundles (ADR-028).",
      severity: "error",
      from: {
        path: "^packages/cms/src/(index|routes|navigation|locked-copy)\\.ts$|^packages/cms/src/content/",
      },
      to: { path: pkg("next|react|@sanity|sanity|groq") },
    },
    {
      name: "ui-no-framework-or-platform",
      comment:
        "packages/ui is presentation only: no Next.js, CMS, config or Supabase. Links are plain anchors.",
      severity: "error",
      from: { path: "^packages/ui/" },
      to: { path: `${pkg("next|@supabase|@vitalos/cms|@vitalos/config")}|^packages/(cms|config)/` },
    },
    {
      name: "relay-widget-contract-only",
      comment:
        "The Relay widget runs in the browser: it may use only the browser-safe contract of relay-core (types and copy), never its server code (ADR-031).",
      severity: "error",
      from: { path: "^packages/relay-widget/" },
      to: { path: "^packages/relay-core/src/", pathNot: "^packages/relay-core/src/contract/" },
    },
    {
      name: "relay-knowledge-cli-not-in-web",
      comment:
        "The ingest, FAQ sync and eval CLIs are run with node, never bundled into the website.",
      severity: "error",
      from: { path: "^apps/" },
      to: { path: "^packages/relay-knowledge/(src/cli|scripts)/" },
    },
    {
      name: "motion-only-in-ui",
      comment:
        "Motion for React is used only inside @vitalos/ui client islands (ADR-024): apps and other packages use the islands, so every animation keeps the shared reduced-motion, LazyMotion and no-hidden-server-HTML rules.",
      severity: "error",
      from: { path: "^(apps|packages|services|workers)/", pathNot: "^packages/ui/" },
      to: { path: pkg("motion|framer-motion|motion-dom|motion-utils") },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // node_modules stays in the graph (as unfollowed leaves) so rules can forbid specific packages.
    exclude: "(^|/)(\\.next|storybook-static|dist)(/|$)",
    tsPreCompilationDeps: true,
    // Resolve workspace packages through their `exports` map (e.g. @vitalos/cms/repo) so
    // rules see real file paths instead of unresolved bare module names.
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
