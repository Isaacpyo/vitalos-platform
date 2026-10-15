import type { KbAdminMeta, KbPublicMeta, KbSource, KbStatus } from "../db/types";
import type { KnowledgeType } from "../schemas/api";

/**
 * A knowledge entry from any source, ready to ingest. `chunks` is optional: when omitted the body
 * is chunked by heading (`chunkMarkdown`); FAQ entries supply exactly one chunk.
 */
export interface KnowledgeEntry {
  source: KbSource;
  sourceRef: string;
  externalId: string | null;
  title: string;
  url: string | null;
  type: KnowledgeType;
  bodyMd: string;
  status: KbStatus;
  owner: string | null;
  reviewDate: string | null;
  meta: KnowledgeMeta;
  adminMeta: KbAdminMeta;
  chunks?: { heading: string; content: string; embeddingText?: string }[];
  checksum: string;
}

export type KnowledgeMeta = KbPublicMeta;
