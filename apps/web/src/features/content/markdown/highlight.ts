import type { Element } from "hast";
import type { HighlighterCore } from "shiki/core";

/**
 * Server-side syntax highlighting with Shiki (brief 4.4): no client JavaScript. The core build
 * with the JavaScript regex engine (no WebAssembly) and a fixed set of grammars, each loaded the
 * first time it is needed, keeps the server bundle and cold starts small. Night Owl suits the midnight code-block ground; the block's own background is
 * removed so the site's token sets it, and only the token colours (inline `color` styles that
 * Shiki generates from the code text, never from input attributes) remain.
 */

export const CODE_THEME = "night-owl";

/** Fence language (lowercase) -> Shiki grammar. Anything else renders as plain, escaped text. */
const languages = {
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  css: "css",
  csharp: "csharp",
  cs: "csharp",
  diff: "diff",
  dockerfile: "docker",
  docker: "docker",
  go: "go",
  graphql: "graphql",
  hcl: "hcl",
  terraform: "hcl",
  tf: "hcl",
  html: "html",
  java: "java",
  javascript: "javascript",
  js: "javascript",
  mjs: "javascript",
  json: "json",
  jsonc: "json",
  jsx: "jsx",
  kotlin: "kotlin",
  markdown: "markdown",
  md: "markdown",
  powershell: "powershell",
  ps1: "powershell",
  python: "python",
  py: "python",
  ruby: "ruby",
  rust: "rust",
  sql: "sql",
  swift: "swift",
  toml: "toml",
  tsx: "tsx",
  typescript: "typescript",
  ts: "typescript",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
} as const;

type Grammar = (typeof languages)[keyof typeof languages];

/** Grammar loaders: each grammar is imported the first time a block needs it. */
const loaders: Record<Grammar, () => Promise<unknown>> = {
  bash: () => import("shiki/langs/bash.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  csharp: () => import("shiki/langs/csharp.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  docker: () => import("shiki/langs/docker.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  graphql: () => import("shiki/langs/graphql.mjs"),
  hcl: () => import("shiki/langs/hcl.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  powershell: () => import("shiki/langs/powershell.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
};

let highlighter: Promise<HighlighterCore> | undefined;
const loading = new Map<Grammar, Promise<void>>();

function loadHighlighter(): Promise<HighlighterCore> {
  highlighter ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighterCore({
      themes: [import("shiki/themes/night-owl.mjs")],
      langs: [],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
  })();
  // A failed load must not poison every later render.
  highlighter.catch(() => {
    highlighter = undefined;
  });
  return highlighter;
}

async function loadGrammar(shiki: HighlighterCore, grammar: Grammar): Promise<void> {
  if (shiki.getLoadedLanguages().includes(grammar)) return;
  let pending = loading.get(grammar);
  if (!pending) {
    pending = (async () => {
      const grammarModule = (await loaders[grammar]()) as {
        default: Parameters<HighlighterCore["loadLanguage"]>[0];
      };
      await shiki.loadLanguage(grammarModule.default);
    })();
    loading.set(grammar, pending);
    pending.catch(() => loading.delete(grammar));
  }
  await pending;
}

export function grammarFor(language: string | undefined): Grammar | undefined {
  if (!language) return undefined;
  const key = language.toLowerCase();
  return Object.hasOwn(languages, key) ? languages[key as keyof typeof languages] : undefined;
}

/**
 * Highlights `code` into a `<pre>` element, or returns undefined when the language is unknown
 * or highlighting fails (the caller then keeps the plain, escaped block).
 */
export async function highlightToPre(code: string, grammar: Grammar): Promise<Element | undefined> {
  try {
    const shiki = await loadHighlighter();
    await loadGrammar(shiki, grammar);
    const root = shiki.codeToHast(code, { lang: grammar, theme: CODE_THEME });
    const pre = root.children.find(
      (node): node is Element => node.type === "element" && node.tagName === "pre",
    );
    return pre;
  } catch {
    return undefined;
  }
}
