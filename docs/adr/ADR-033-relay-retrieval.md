# ADR 033 Relay retrieval: hybrid Postgres full-text and pgvector

Status: Accepted (engineering, 15 October 2026).

## Context

Relay must answer only from published Vitalos knowledge, cite it, and say when it does not know. Retrieval has to handle exact wording (offer names, FAQ questions) and paraphrases, and run inside the website's existing Supabase project.

## Decision

1. Knowledge lives in `relay.kb_documents` and `relay.kb_chunks`, from four sources:
   - `cms`: the published repo content, `@vitalos/cms/repo` (ADR-028);
   - `repo`: `packages/relay-knowledge/content/*.md`;
   - `faq`: the Notion Master FAQ, Verified entries only;
   - `team_answer`: drafts saved from staff replies.

   Only `published` documents are searched.

2. Chunks are at most about 300 words, with about 40 words of overlap, and keep their heading path. Each FAQ entry is one chunk.
3. Embeddings come from **gte-small** (384 dimensions, normalised), served by the Supabase Edge Function `relay-embed`. It verifies the JWT and also requires the shared secret `x-relay-embed-secret`. DeepSeek has no embeddings API.
4. `relay.match_chunks(query_text, query_embedding, match_count, rrf_k, page_path)` fuses two rankings by reciprocal rank fusion: a `websearch_to_tsquery` full-text ranking and an inner-product vector ranking. Documents placed on the visitor's current page get a small bonus. With no embedding, it ranks on full text only.
5. Confidence:
   - The top similarity is normalised from `[RELAY_SIM_FLOOR, 1]`, plus 0.1 when full text also matched.
   - Below the threshold (Settings, default 0.55), the model gets no sources and Relay offers a person.
   - The full-text-only fallback uses a calibrated `ts_rank_cd` mapping.
   - `pnpm relay:eval` calibrates the floor and the threshold.

## Options

A hosted vector database (another processor and another secret); OpenAI embeddings (another provider and another transfer); keyword search only (misses paraphrases).

## Consequences

Retrieval stays inside the website database. The embedding function is the only new runtime component; when it fails, retrieval falls back to full text.
