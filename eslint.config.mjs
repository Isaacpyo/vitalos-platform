import base from "@vitalos/eslint-config/base";
export default [
  ...base,
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/storybook-static/**",
      "tooling/scripts/*.mjs",
    ],
  },
];
