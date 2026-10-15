/**
 * pnpm relay:load [--base http://localhost:3101] [--concurrency 50] [--questions 2]
 *
 * Load test (Relay build prompt, Phase 6): starts `concurrency` conversations at once against a
 * running website. Each one asks `questions` questions over SSE, then is deleted. Reports time to
 * first token and to the done event (p50 / p95 / max) and errors by kind. On a DeepSeek server
 * each question spends credit, so 50 × 2 short questions is the intended size. The target needs
 * RELAY_RATE_LIMIT_MULTIPLIER (outside production) or several source IPs, because one IP is
 * limited to 30 conversations an hour.
 */
import { randomUUID } from "node:crypto";

const argv = process.argv.slice(2);
const opt = (f: string) => {
  const i = argv.indexOf(`--${f}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const base = (opt("base") ?? "http://localhost:3101").replace(/\/$/, "");
const concurrency = Number(opt("concurrency") ?? 50);
const perConversation = Number(opt("questions") ?? 2);
const QUESTIONS = [
  "Can you rescue a failing software project?",
  "Are you ISO 27001 certified?",
  "How do you price your work?",
  "Do you work with health and care organisations?",
  "What is an AI Prototype Sprint?",
  "Who owns the code you write for us?",
];

const firstToken: number[] = [];
const total: number[] = [];
const errors = new Map<string, number>();
const fail = (kind: string): void => {
  errors.set(kind, (errors.get(kind) ?? 0) + 1);
};

async function conversation(n: number): Promise<void> {
  const headers = { origin: base, "content-type": "application/json" };
  const created = await fetch(`${base}/api/relay/conversations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", pageUrl: `${base}/` }),
  });
  if (created.status !== 201) return fail(`create ${created.status}`);
  const { conversationId, visitorToken } = (await created.json()) as {
    conversationId: string;
    visitorToken: string;
  };
  const auth = { ...headers, authorization: `Bearer ${visitorToken}` };
  try {
    for (let q = 0; q < perConversation; q += 1) {
      const started = performance.now();
      const res = await fetch(`${base}/api/relay/chat`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          conversationId,
          clientMessageId: randomUUID(),
          text: QUESTIONS[(n + q) % QUESTIONS.length],
          pageUrl: `${base}/`,
        }),
      });
      if (res.status !== 200 || !res.body) {
        fail(`chat ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawFirst = false;
      let done = false;
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        if (!sawFirst && buffer.includes("event: delta")) {
          sawFirst = true;
          firstToken.push(performance.now() - started);
        }
        if (buffer.includes("event: error")) fail("error event");
        if (buffer.includes("event: done")) done = true;
      }
      if (done) total.push(performance.now() - started);
      else fail("no done event");
    }
  } finally {
    await fetch(`${base}/api/relay/conversations/${conversationId}`, {
      method: "DELETE",
      headers: auth,
    }).catch(() => undefined);
  }
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] as number) : 0;
};
const started = performance.now();
await Promise.all(
  Array.from({ length: concurrency }, (_, n) => conversation(n).catch(() => fail("network"))),
);
const seconds = (performance.now() - started) / 1000;
console.log(
  `${concurrency} concurrent conversations × ${perConversation} questions against ${base} in ${seconds.toFixed(1)}s`,
);
console.log(`answers completed: ${total.length}/${concurrency * perConversation}`);
console.log(
  `first token ms: p50 ${pct(firstToken, 0.5)} p95 ${pct(firstToken, 0.95)} max ${pct(firstToken, 1)}`,
);
console.log(`done ms:        p50 ${pct(total, 0.5)} p95 ${pct(total, 0.95)} max ${pct(total, 1)}`);
console.log(
  `errors: ${errors.size ? [...errors].map(([k, v]) => `${k} ×${v}`).join(", ") : "none"}`,
);
process.exitCode = errors.size ? 1 : 0;
