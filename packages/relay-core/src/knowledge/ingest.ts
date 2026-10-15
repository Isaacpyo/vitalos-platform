import type { Embedder } from "../retrieval/embed";
import type { KbSource, RelayStore } from "../db/types";
import { chunkMarkdown, embeddingInput, estimateTokens } from "./chunk";
import type { KnowledgeEntry } from "./types";

export interface IngestResult {
  added: number;
  updated: number;
  unchanged: number;
  archived: number;
  chunks: number;
  embedded: number;
  repaired: number;
  errors: string[];
}

export interface IngestOptions {
  /** Archive stored documents of these sources that are not in `entries` (deleted upstream). */
  archiveMissingFor?: KbSource[];
  /** Re-chunk and re-embed even when the checksum is unchanged. */
  force?: boolean;
  /** For unchanged entries, re-embed when any stored chunk has no embedding (an earlier failure). */
  repairEmbeddings?: boolean;
  updatedBy?: string | null;
}

/** Builds the chunks for an entry: supplied chunks (FAQ) or heading-based markdown chunks. */
export function chunksFor(
  entry: KnowledgeEntry,
): { heading: string; content: string; embeddingText: string; tokenCount: number }[] {
  if (entry.chunks) return entry.chunks.map(withTokens);
  return chunkMarkdown(entry.title, entry.bodyMd).map((c) => ({
    heading: c.heading,
    content: c.content,
    embeddingText: embeddingInput(entry.title, c.heading, c.content),
    tokenCount: c.tokenCount,
  }));
}

function withTokens(c: { heading: string; content: string; embeddingText?: string }) {
  return {
    heading: c.heading,
    content: c.content,
    embeddingText: c.embeddingText ?? `${c.heading}: ${c.content}`,
    tokenCount: estimateTokens(c.content),
  };
}

/**
 * Idempotent ingest: upsert by source_ref (or external id), re-chunk and re-embed only when the
 * checksum changed. Entries without publishable text (held or unverified FAQ rows) are stored
 * with no chunks, so they can never be retrieved.
 */
export async function ingestEntries(
  store: RelayStore,
  embedder: Embedder,
  entries: readonly KnowledgeEntry[],
  options: IngestOptions = {},
): Promise<IngestResult> {
  const result: IngestResult = {
    added: 0,
    updated: 0,
    unchanged: 0,
    archived: 0,
    chunks: 0,
    embedded: 0,
    repaired: 0,
    errors: [],
  };

  for (const entry of entries) {
    try {
      const { document, changed, created } = await store.upsertDocument({
        source: entry.source,
        sourceRef: entry.sourceRef,
        externalId: entry.externalId,
        title: entry.title,
        url: entry.url,
        type: entry.type,
        bodyMd: entry.bodyMd,
        checksum: entry.checksum,
        status: entry.status,
        owner: entry.owner,
        reviewDate: entry.reviewDate,
        updatedBy: options.updatedBy ?? null,
        meta: entry.meta,
        adminMeta: entry.adminMeta,
      });
      if (created) result.added += 1;
      else if (changed) result.updated += 1;
      else result.unchanged += 1;

      if (!created && !changed && !options.force) {
        if (!options.repairEmbeddings || !embedder.enabled) continue;
        const stored = await store.listChunksForDocument(document.id);
        if (stored.length === 0 || stored.every((c) => c.hasEmbedding)) continue;
        result.repaired += 1;
      }

      const hasText = entry.bodyMd.trim().length > 0 || (entry.chunks?.length ?? 0) > 0;
      const chunks = hasText ? chunksFor(entry) : [];
      const vectors =
        chunks.length > 0 ? await embedder.embed(chunks.map((c) => c.embeddingText)) : [];
      if (vectors) result.embedded += vectors.length;
      await store.replaceChunks(
        document.id,
        chunks.map((c, ix) => ({
          ix,
          heading: c.heading,
          content: c.content,
          tokenCount: c.tokenCount,
          embedding: vectors?.[ix] ?? null,
        })),
      );
      result.chunks += chunks.length;
    } catch (error) {
      result.errors.push(
        `${entry.sourceRef}: ${error instanceof Error ? error.message : "failed"}`,
      );
    }
  }

  for (const source of options.archiveMissingFor ?? []) {
    const keep = new Set(entries.filter((e) => e.source === source).map((e) => e.sourceRef));
    for (const stored of await store.listSourceRefs(source)) {
      if (keep.has(stored.sourceRef) || stored.status === "archived") continue;
      await store.setDocumentStatus(stored.id, "archived", options.updatedBy ?? null);
      await store.replaceChunks(stored.id, []);
      result.archived += 1;
    }
  }
  return result;
}
