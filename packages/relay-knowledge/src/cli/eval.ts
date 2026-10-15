/**
 * pnpm relay:eval --retrieval [--json out.json]   retrieval eval (no model calls, no cost)
 * pnpm relay:eval --answers                         answer eval against the configured provider
 *                                                    (spends a little DeepSeek credit when
 *                                                    RELAY_LLM_PROVIDER=deepseek; keep runs small)
 *
 * Retrieval eval (Relay follow-up, section 11): every live FAQ question must retrieve its entry in
 * the top 3 (target ≥ 95%), and every paraphrase in docs/relay/evals/faq-paraphrases.jsonl must too
 * (target ≥ 85%). Also reports recall by section, the similarity distribution of answerable versus
 * off-topic questions (to calibrate RELAY_SIM_FLOOR and the threshold), and the Phase 1 check that
 * "rescue a failing project" ranks Engineering Rescue first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HttpEmbedder,
  SupabaseRelayStore,
  nullEmbedder,
  retrieve,
} from "@vitalos/relay-core/knowledge";
import type { RetrievalResult } from "@vitalos/relay-core/knowledge";
import { faqSnapshot } from "../faq";

const here = dirname(fileURLToPath(import.meta.url));
const evalDir = resolve(here, "../../../../docs/relay/evals");
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(`--${f}`);
const opt = (f: string) => {
  const i = argv.indexOf(`--${f}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  process.exit(2);
}
const store = new SupabaseRelayStore({ url, secretKey });
const embedder =
  process.env.RELAY_EMBED_FUNCTION_URL && process.env.RELAY_EMBED_SECRET && !has("fts-only")
    ? new HttpEmbedder({
        url: process.env.RELAY_EMBED_FUNCTION_URL,
        secret: process.env.RELAY_EMBED_SECRET,
      })
    : nullEmbedder;
const simFloor = Number(opt("floor") ?? process.env.RELAY_SIM_FLOOR ?? 0.7);
const threshold = Number(opt("threshold") ?? 0.55);
const pageBonus = Number(opt("page-bonus") ?? 0.25);

async function ask(question: string, pagePath?: string): Promise<RetrievalResult> {
  return retrieve(store, embedder, {
    question,
    pagePath: pagePath ?? null,
    simFloor,
    threshold,
    embedTimeoutMs: 20_000,
    pageBonus,
  });
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
const quantiles = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) =>
    s.length ? (s[Math.min(s.length - 1, Math.floor(p * s.length))] as number).toFixed(3) : "-";
  return `min ${q(0)} p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)} max ${q(0.999)}`;
};

if (has("retrieval")) {
  const report: Record<string, unknown> = {
    simFloor,
    threshold,
    pageBonus,
    semantic: embedder.enabled,
  };

  // 1. Exact FAQ questions
  const bySection = new Map<string, { n: number; hit: number }>();
  const misses: string[] = [];
  const positiveSims: number[] = [];
  const positiveConf: number[] = [];
  for (const e of faqSnapshot.entries) {
    const r = await ask(e.question);
    const hit = r.chunks.slice(0, 3).some((c) => c.source === "faq" && c.externalId === e.id);
    const s = bySection.get(e.section) ?? { n: 0, hit: 0 };
    s.n += 1;
    if (hit) s.hit += 1;
    else
      misses.push(
        `${e.id} → ${r.chunks
          .slice(0, 3)
          .map((c) => c.externalId ?? c.title)
          .join(", ")}`,
      );
    bySection.set(e.section, s);
    if (r.topSimilarity !== null) positiveSims.push(r.topSimilarity);
    positiveConf.push(r.confidence);
  }
  const exactHits = [...bySection.values()].reduce((a, s) => a + s.hit, 0);
  console.log(
    `\nExact FAQ questions: ${exactHits}/${faqSnapshot.entries.length} in top 3 (${pct(exactHits, faqSnapshot.entries.length)}; target ≥ 95%)`,
  );
  for (const [section, s] of [...bySection].sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    console.log(`  ${section.padEnd(30)} ${s.hit}/${s.n}`);
  }
  if (misses.length) console.log(`  misses:\n    ${misses.join("\n    ")}`);
  report.exact = { hits: exactHits, total: faqSnapshot.entries.length, misses };

  // 2. Paraphrases
  const paraphrasePath = resolve(evalDir, "faq-paraphrases.jsonl");
  let paraphrases: { id: string; q: string }[] = [];
  try {
    paraphrases = readFileSync(paraphrasePath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as { id: string; q: string })
      .filter((p) => faqSnapshot.entries.some((e) => e.id === p.id));
  } catch {
    // no paraphrase file yet
  }
  let paraHits = 0;
  const paraMisses: string[] = [];
  for (const p of paraphrases) {
    const r = await ask(p.q);
    if (r.chunks.slice(0, 3).some((c) => c.source === "faq" && c.externalId === p.id))
      paraHits += 1;
    else
      paraMisses.push(
        `${p.id} "${p.q}" → ${r.chunks
          .slice(0, 3)
          .map((c) => c.externalId ?? c.title)
          .join(", ")}`,
      );
  }
  console.log(
    `\nParaphrases: ${paraHits}/${paraphrases.length} in top 3 (${pct(paraHits, paraphrases.length)}; target ≥ 85%)`,
  );
  if (paraMisses.length) console.log(`  misses:\n    ${paraMisses.join("\n    ")}`);
  report.paraphrases = { hits: paraHits, total: paraphrases.length, misses: paraMisses };

  // 3. Off-topic and unanswerable questions (should fall below the threshold)
  const negatives = [
    "What is the capital of France?",
    "Write me a Python function to reverse a string",
    "What's the weather like in Leeds tomorrow?",
    "Can you recommend a good pizza place?",
    "Who won the football last night?",
    "Tell me a joke",
    "How do I bake sourdough bread?",
    "What is your day rate?",
    "How many employees do you have?",
    "Which clients have you worked with?",
  ];
  const negSims: number[] = [];
  const negConf: number[] = [];
  let negBelow = 0;
  for (const q of negatives) {
    const r = await ask(q);
    if (r.topSimilarity !== null) negSims.push(r.topSimilarity);
    negConf.push(r.confidence);
    if (!r.confident) negBelow += 1;
  }
  console.log(`\nSimilarity (answerable FAQ questions): ${quantiles(positiveSims)}`);
  console.log(`Similarity (off-topic / unanswerable):  ${quantiles(negSims)}`);
  console.log(
    `Confidence answerable: ${quantiles(positiveConf)}; below threshold: ${positiveConf.filter((c) => c < threshold).length}`,
  );
  console.log(
    `Confidence off-topic:  ${quantiles(negConf)}; below threshold: ${negBelow}/${negatives.length}`,
  );
  report.similarity = { positive: positiveSims, negative: negSims };

  // 4. Phase 1 acceptance
  const rescue = await ask("rescue a failing project");
  const first = rescue.chunks[0];
  console.log(
    `\n"rescue a failing project" → ${first ? `${first.title} (${first.source})` : "nothing"}`,
  );
  report.rescueFirst = first?.title ?? null;

  const out = opt("json");
  if (out) writeFileSync(out, JSON.stringify(report, null, 2));
}
