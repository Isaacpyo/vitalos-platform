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
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: "(^|/)(node_modules|.next|storybook-static|dist)(/|$)",
    tsPreCompilationDeps: true,
  },
};
