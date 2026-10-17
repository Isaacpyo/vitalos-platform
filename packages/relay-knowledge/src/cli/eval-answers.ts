/**
 * pnpm relay:eval --answers [--base http://localhost:3101] [--only id,id] [--json out.json]
 *
 * Answer eval (Relay build prompt section 9, follow-up section 11): asks every question in
 * docs/relay/evals/golden.jsonl through the visitor API of a running website, one new
 * conversation each, so retrieval, the prompt, marker handling and citations are all exercised.
 * The answers come from whichever provider that server runs: the mock locally (a pipeline check),
 * DeepSeek on a preview (spends a little credit; 15 short questions).
 *
 * A protected Vercel preview needs VERCEL_AUTOMATION_BYPASS_SECRET (the project's automation bypass).
 *
 * Each golden line: {id, q, page?, cite?: [FAQ ids, all required], citeAny?: [FAQ ids],
 * must?: [regex], mustNot?: [regex], lowConfidence?: true, allowLowConfidence?: true,
 * handoff?: true}. Every answer is also checked for leaked markers, currency amounts, more than
 * three citations and banned words. Prints ids, verdicts and the failing checks only.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED_WORDS } from "@vitalos/relay-core/knowledge";
import { faqSnapshot } from "../faq";

interface Golden {
  id: string;
  q: string;
  page?: string;
  cite?: string[];
  citeAny?: string[];
  must?: string[];
  mustNot?: string[];
  lowConfidence?: boolean;
  allowLowConfidence?: boolean;
  handoff?: boolean;
}

interface Done {
  text: string;
  citations: { n: number; title: string; url: string | null }[];
  handoffSuggested: boolean;
  lowConfidence: boolean;
  confidence: number;
}

const argv = process.argv.slice(2);
const opt = (f: string) => {
  const i = argv.indexOf(`--${f}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = resolve(here, "../../../../docs/relay/evals/golden.jsonl");
const base = (opt("base") ?? process.env.RELAY_EVAL_BASE_URL ?? "http://localhost:3101").replace(
  /\/$/,
  "",
);
const only = opt("only")?.split(",");

const golden = readFileSync(goldenPath, "utf8")
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Golden)
  .filter((g) => !only || only.includes(g.id));

const questionOf = (id: string) => faqSnapshot.entries.find((e) => e.id === id)?.question;
const CURRENCY = /[£$€]\s?\d|\b\d[\d,.]*\s?(GBP|USD|EUR|pounds)\b/i;
const MARKER = /\[\[\s*handoff\s*\]\]/i;

// Protected Vercel previews: pass the project's automation bypass secret (never logged).
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

async function ask(g: Golden): Promise<Done> {
  const headers = {
    origin: base,
    "content-type": "application/json",
    ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
  };
  const pageUrl = `${base}${g.page ?? "/"}`;
  const created = await fetch(`${base}/api/relay/conversations`, {
    method: "POST",
    headers,
    // utm_source tags this usage as test traffic in Relay Insights (ADR-048).
    body: JSON.stringify({
      turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
      pageUrl,
      utm: { utm_source: "relay-eval" },
    }),
  });
  if (created.status !== 201) throw new Error(`create conversation: HTTP ${created.status}`);
  const { conversationId, visitorToken } = (await created.json()) as {
    conversationId: string;
    visitorToken: string;
  };
  try {
    const res = await fetch(`${base}/api/relay/chat`, {
      method: "POST",
      headers: { ...headers, authorization: `Bearer ${visitorToken}` },
      body: JSON.stringify({ conversationId, clientMessageId: randomUUID(), text: g.q, pageUrl }),
    });
    if (res.status !== 200) throw new Error(`chat: HTTP ${res.status}`);
    const frames = (await res.text()).split(/\n\n/);
    for (const frame of frames) {
      const event = /^event: (\w+)/m.exec(frame)?.[1];
      const data = /^data: (.*)$/m.exec(frame)?.[1];
      if (event === "error") throw new Error(`chat error event`);
      if (event === "done" && data) return JSON.parse(data) as Done;
    }
    throw new Error("no done event");
  } finally {
    // Leave nothing behind: eval conversations are deleted straight away.
    await fetch(`${base}/api/relay/conversations/${conversationId}`, {
      method: "DELETE",
      headers: { ...headers, authorization: `Bearer ${visitorToken}` },
    }).catch(() => undefined);
  }
}

function check(g: Golden, d: Done): string[] {
  const failures: string[] = [];
  const titles = d.citations.map((c) => c.title);
  for (const id of g.cite ?? [])
    if (!titles.includes(questionOf(id) ?? `missing ${id}`)) failures.push(`does not cite ${id}`);
  if (g.citeAny && !g.citeAny.some((id) => titles.includes(questionOf(id) ?? "")))
    failures.push(`cites none of ${g.citeAny.join("/")}`);
  for (const r of g.must ?? [])
    if (!new RegExp(r, "i").test(d.text)) failures.push(`missing /${r}/`);
  for (const r of g.mustNot ?? [])
    if (new RegExp(r, "i").test(d.text)) failures.push(`contains /${r}/`);
  if (g.lowConfidence && !d.lowConfidence) failures.push("expected low confidence");
  if (!g.lowConfidence && !g.allowLowConfidence && !g.handoff && d.lowConfidence)
    failures.push(`low confidence (${d.confidence.toFixed(2)})`);
  if (g.handoff && !d.handoffSuggested) failures.push("no hand-off offered");
  if (MARKER.test(d.text)) failures.push("marker leaked");
  if (CURRENCY.test(d.text)) failures.push("currency amount");
  if (d.citations.length > 3) failures.push(`${d.citations.length} citations`);
  for (const w of BANNED_WORDS)
    if (new RegExp(`\\b${w}\\b`, "i").test(d.text)) failures.push(`banned word "${w}"`);
  return failures;
}

const results: { id: string; pass: boolean; failures: string[]; citations: string[] }[] = [];
for (const g of golden) {
  try {
    const d = await ask(g);
    const failures = check(g, d);
    results.push({
      id: g.id,
      pass: failures.length === 0,
      failures,
      citations: d.citations.map((c) => c.title),
    });
  } catch (error) {
    results.push({
      id: g.id,
      pass: false,
      failures: [error instanceof Error ? error.message : "request failed"],
      citations: [],
    });
  }
  const r = results.at(-1)!;
  console.log(`${r.pass ? "pass" : "FAIL"}  ${r.id}${r.pass ? "" : `: ${r.failures.join("; ")}`}`);
}
const passed = results.filter((r) => r.pass).length;
console.log(`\nAnswers: ${passed}/${results.length} pass (${base})`);
const out = opt("json");
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
process.exitCode = passed === results.length ? 0 : 1;
