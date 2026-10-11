// Fails when packages/config/src/schema.ts reads an env var that turbo.json does not declare.
// Turbo 2 strict env mode drops undeclared variables, so they would not reach `next build`.
import { readFileSync } from "node:fs";

const schema = await import(new URL("../../packages/config/src/schema.ts", import.meta.url).href);
const turbo = JSON.parse(readFileSync(new URL("../../turbo.json", import.meta.url), "utf8"));
const declared = new Set([
  ...(turbo.globalEnv ?? []),
  ...Object.values(turbo.tasks ?? {}).flatMap((task) => task.env ?? []),
]);
const missing = schema.envKeys.filter((name) => !declared.has(name));
if (missing.length > 0) {
  console.error(`turbo.json does not declare (add to globalEnv): ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`turbo.json declares all ${schema.envKeys.length} schema env variables.`);
