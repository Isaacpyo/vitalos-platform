// Generates the content API types from the contract (ADR-036) with openapi-typescript, formatted
// with the repository's Prettier config, into src/features/content/generated/openapi.ts.
//
//   node scripts/content-types.mjs          write the file
//   node scripts/content-types.mjs --check  exit 1 when the committed file differs (drift)
//
// The web tests run the same comparison (src/features/content/contract.test.ts), so drift fails CI.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";
import prettier from "prettier";

export const contractUrl = new URL(
  "../../../contracts/content-api/v1/openapi.yaml",
  import.meta.url,
);
export const generatedUrl = new URL(
  "../src/features/content/generated/openapi.ts",
  import.meta.url,
);

const HEADER = `/**
 * GENERATED from contracts/content-api/v1/openapi.yaml by openapi-typescript. Do not edit.
 * Regenerate with \`pnpm content:types\`; \`pnpm content:types:check\` and the web tests fail on drift.
 */
`;

/** The generated module's source, formatted exactly as it is committed. */
export async function generateContentTypes() {
  const ast = await openapiTS(contractUrl, { exportType: false, alphabetize: false });
  const source = HEADER + astToString(ast);
  const filepath = fileURLToPath(generatedUrl);
  const options = (await prettier.resolveConfig(filepath)) ?? {};
  return prettier.format(source, { ...options, filepath });
}

async function main() {
  const generated = await generateContentTypes();
  if (process.argv.includes("--check")) {
    const committed = await readFile(generatedUrl, "utf8").catch(() => "");
    if (committed.replace(/\r\n/g, "\n") !== generated) {
      console.error(
        "src/features/content/generated/openapi.ts is out of date with the contract. Run `pnpm content:types`.",
      );
      process.exit(1);
    }
    console.log("Content API types match the contract.");
    return;
  }
  await writeFile(generatedUrl, generated);
  console.log("Wrote src/features/content/generated/openapi.ts");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
