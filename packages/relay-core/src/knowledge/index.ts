/**
 * Knowledge entry points shared by the ingest CLIs (`@vitalos/relay-knowledge`) and the website's
 * cron and admin routes. Server-only: imports node:crypto.
 */
export { chunkMarkdown, embeddingInput, estimateTokens, MAX_WORDS, OVERLAP_WORDS } from "./chunk";
export type { Chunk } from "./chunk";
export { checksumOf, stableStringify } from "./checksum";
export {
  BANNED_WORDS,
  canonicalPath,
  holdReasons,
  mapFaqRow,
  nextStepFor,
  normaliseWhitespace,
  plainText,
  sectionOrder,
  stripConfirmBlocks,
} from "./faq";
export type { FaqMapOptions, FaqMapped, FaqRow, FaqStatus } from "./faq";
export { chunksFor, ingestEntries } from "./ingest";
export type { IngestOptions, IngestResult } from "./ingest";
export type { KnowledgeEntry, KnowledgeMeta } from "./types";
export { HttpEmbedder, nullEmbedder, EMBEDDING_DIMENSIONS } from "../retrieval/embed";
export type { Embedder } from "../retrieval/embed";
export { SupabaseRelayStore } from "../db/supabase";
export { MemoryRelayStore } from "../db/memory";
export type { KbSource, KbStatus, RelayStore } from "../db/types";
export { composeQuery, ftsConfidence, retrieve, semanticConfidence } from "../retrieval/search";
export type { RetrievalOptions, RetrievalResult } from "../retrieval/search";
