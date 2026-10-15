// Node module hooks for the repo scripts that import workspace TypeScript directly (Node 24
// strips the types). The workspace sources use extensionless relative imports, as the bundler
// resolves them; this resolver tries `.ts`, `.tsx` and `/index.ts` when Node cannot.
import { registerHooks } from "node:module";

const candidates = (specifier) => [`${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`];

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!(specifier.startsWith(".") || specifier.startsWith("/"))) throw error;
      for (const candidate of candidates(specifier)) {
        try {
          return nextResolve(candidate, context);
        } catch {
          // try the next form
        }
      }
      throw error;
    }
  },
});
