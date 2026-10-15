// Vitalos Relay embeddings (ADR-037): gte-small, 384 dimensions, mean-pooled and normalised.
//
// POST { "texts": string[] } (1 to 32 items, each at most 8,000 characters)
// -> 200 { "embeddings": number[][] }
//
// Never callable anonymously: every request must carry `x-relay-embed-secret` equal to the
// RELAY_EMBED_SECRET function secret (compared in constant time). Inputs are never logged.

// deno-lint-ignore-file no-explicit-any
declare const Supabase: any;

const MAX_TEXTS = 32;
const MAX_CHARS = 8000;

const session = new Supabase.ai.Session("gte-small");

function constantTimeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) {
    diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  }
  return diff === 0;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: { code: "method_not_allowed" } });

  const secret = Deno.env.get("RELAY_EMBED_SECRET") ?? "";
  const presented = req.headers.get("x-relay-embed-secret") ?? "";
  if (secret.length < 32 || !constantTimeEqual(presented, secret)) {
    return json(401, { error: { code: "unauthorised" } });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: { code: "invalid_json" } });
  }
  const texts = (body as { texts?: unknown })?.texts;
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > MAX_TEXTS ||
    !texts.every((t) => typeof t === "string" && t.length > 0 && t.length <= MAX_CHARS)
  ) {
    return json(400, { error: { code: "invalid_texts" } });
  }

  try {
    const embeddings: number[][] = [];
    for (const text of texts as string[]) {
      const vector = await session.run(text, { mean_pool: true, normalize: true });
      embeddings.push(Array.from(vector as ArrayLike<number>));
    }
    return json(200, { embeddings });
  } catch {
    return json(500, { error: { code: "embedding_failed" } });
  }
});
