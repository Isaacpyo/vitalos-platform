// Minimal ambient declarations for css.test.ts so the package needs no @types/node dependency.
declare module "node:fs" {
  export function readFileSync(path: URL, encoding: "utf8"): string;
  export function writeFileSync(path: URL, data: string): void;
}
declare const process: { env: Record<string, string | undefined> };
