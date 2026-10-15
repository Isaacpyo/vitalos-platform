/**
 * Embedding client for the `relay-embed` Edge Function (gte-small, 384 dimensions, normalised).
 * Failures return null so retrieval can fall back to full-text search (ADR-037).
 */
export interface Embedder {
  /** One vector per text, or null when embeddings are unavailable. */
  embed(texts: string[], opts?: { timeoutMs?: number }): Promise<number[][] | null>;
  readonly enabled: boolean;
}

export const EMBEDDING_DIMENSIONS = 384;
/** Small batches keep each request inside the Edge Function CPU limit; failed batches are halved. */
const BATCH = 8;
/** gte-small reads at most 512 tokens; longer input only costs CPU. */
const MAX_INPUT_CHARS = 2000;

export class HttpEmbedder implements Embedder {
  readonly enabled = true;

  constructor(
    private readonly options: {
      url: string;
      secret: string;
      fetch?: typeof fetch;
      defaultTimeoutMs?: number;
    },
  ) {}

  async embed(texts: string[], opts: { timeoutMs?: number } = {}): Promise<number[][] | null> {
    if (texts.length === 0) return [];
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const vectors = await this.callSplitting(
        batch,
        opts.timeoutMs ?? this.options.defaultTimeoutMs ?? 20_000,
      );
      if (!vectors) return null;
      out.push(...vectors);
    }
    return out;
  }

  /** Retries a failed batch as two halves, down to single texts. */
  private async callSplitting(texts: string[], timeoutMs: number): Promise<number[][] | null> {
    const vectors = await this.call(texts, timeoutMs);
    if (vectors || texts.length === 1) return vectors;
    const mid = Math.ceil(texts.length / 2);
    const left = await this.callSplitting(texts.slice(0, mid), timeoutMs);
    if (!left) return null;
    const right = await this.callSplitting(texts.slice(mid), timeoutMs);
    return right ? [...left, ...right] : null;
  }

  private async call(texts: string[], timeoutMs: number): Promise<number[][] | null> {
    const doFetch = this.options.fetch ?? fetch;
    try {
      const res = await doFetch(this.options.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-relay-embed-secret": this.options.secret,
        },
        body: JSON.stringify({ texts: texts.map((t) => t.slice(0, MAX_INPUT_CHARS)) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { embeddings?: unknown };
      const vectors = body.embeddings;
      if (
        !Array.isArray(vectors) ||
        vectors.length !== texts.length ||
        !vectors.every(
          (v) =>
            Array.isArray(v) &&
            v.length === EMBEDDING_DIMENSIONS &&
            v.every((x) => typeof x === "number"),
        )
      ) {
        return null;
      }
      return vectors as number[][];
    } catch {
      return null;
    }
  }
}

/** No embeddings configured: retrieval runs on full text only. */
export const nullEmbedder: Embedder = {
  enabled: false,
  embed: () => Promise.resolve(null),
};
