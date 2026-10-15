import { mapFaqRow } from "../knowledge/faq";
import type { FaqRow } from "../knowledge/faq";
import { ingestEntries } from "../knowledge/ingest";
import type { KnowledgeEntry } from "../knowledge/types";
import type { NotionFaqReader } from "../knowledge/notion";
import type { FaqRunSummary, FaqStatus, FaqSyncPort } from "./admin";
import type { RelayContext } from "./context";

export interface SnapshotPort {
  /** Snapshot entries already mapped (Verified, sanitised). */
  entries(options: { requireHubActive: boolean }): KnowledgeEntry[];
  hubStatus: "Draft" | "Active";
  needsConfirmation: { id: string; section: string; notionUrl: string }[];
  held: { id: string; section: string; notionUrl: string; reasons: string[] }[];
}

/**
 * Master FAQ sync (follow-up section 7). With a Notion token: incremental every 15 minutes (rows
 * edited since the last successful run minus two minutes) and a nightly full reconciliation.
 * Without one: runs report "using snapshot"; the committed snapshot is ingested by deploys and by
 * the admin's Sync now.
 */
export class FaqSyncService implements FaqSyncPort {
  constructor(
    private readonly ctx: RelayContext,
    private readonly ports: {
      reader: NotionFaqReader | null;
      snapshot: SnapshotPort;
      routeExists: (path: string) => Promise<(path: string) => boolean>;
      enabled: boolean;
    },
  ) {}

  private get store() {
    return this.ctx.deps.store;
  }

  async status(): Promise<FaqStatus> {
    const runs = await this.store.lastSyncRuns("faq", 1);
    const lastRun = runs[0]
      ? {
          id: runs[0].id,
          mode: runs[0].mode,
          added: runs[0].added,
          updated: runs[0].updated,
          archived: runs[0].archived,
          held: runs[0].held,
          skippedUnverified: runs[0].skippedUnverified,
          errors: runs[0].errors,
          startedAt: runs[0].startedAt,
          finishedAt: runs[0].finishedAt ?? runs[0].startedAt,
        }
      : null;
    if (!this.ports.reader) {
      return {
        mode: "snapshot",
        hubActive: this.ports.snapshot.hubStatus === "Active",
        needsConfirmation: this.ports.snapshot.needsConfirmation.map((n) => ({
          externalId: n.id,
          question: null,
          section: n.section,
          confirmNote: null,
          notionUrl: n.notionUrl,
        })),
        held: this.ports.snapshot.held.map((h) => ({
          externalId: h.id,
          question: null,
          reasons: h.reasons,
          notionUrl: h.notionUrl,
        })),
        lastRun,
      };
    }
    const docs = await this.store.listAdminMetaForSource("faq");
    return {
      mode: "notion",
      hubActive: null,
      needsConfirmation: docs
        .filter((d) => d.adminMeta.needs_confirmation)
        .map((d) => ({
          externalId: d.externalId ?? "",
          question: d.title,
          section: d.meta.section ?? "",
          confirmNote: d.adminMeta.confirm_note ?? null,
          notionUrl: d.meta.notion_url ?? null,
        })),
      held: docs
        .filter((d) => (d.adminMeta.hold_reasons?.length ?? 0) > 0)
        .map((d) => ({
          externalId: d.externalId ?? "",
          question: d.title,
          reasons: d.adminMeta.hold_reasons ?? [],
          notionUrl: d.meta.notion_url ?? null,
        })),
      lastRun,
    };
  }

  /** Cron entry point: no-op in snapshot mode; incremental or full with Notion. */
  async cron(full: boolean): Promise<FaqRunSummary> {
    if (!this.ports.enabled || !this.ports.reader) {
      const now = this.ctx.deps.now().toISOString();
      return {
        mode: "snapshot",
        added: 0,
        updated: 0,
        archived: 0,
        held: 0,
        skippedUnverified: 0,
        errors: ["using snapshot"],
        startedAt: now,
        finishedAt: now,
      };
    }
    return this.sync({ full, actor: "relay:cron" });
  }

  async sync(options: { full: boolean; actor: string }): Promise<FaqRunSummary> {
    const reader = this.ports.reader;
    const routeExists = await this.ports.routeExists("/");
    if (!reader) return this.ingestSnapshot(options.actor, routeExists);

    const previous = (await this.store.lastSyncRuns("faq", 5)).filter((r) => r.mode !== "snapshot");
    const lastGood = previous.find((r) => r.finishedAt && r.errors.length === 0);
    const full = options.full || !lastGood;
    const run = await this.store.startSyncRun("faq", full ? "full" : "incremental");
    try {
      const hubActive = await reader.hubActive();
      const since =
        !full && lastGood?.finishedAt
          ? new Date(Date.parse(lastGood.finishedAt) - 2 * 60_000).toISOString()
          : undefined;
      const { rows } = await reader.rows(since);
      const mapped = rows.map((row: FaqRow) =>
        mapFaqRow(row, {
          routeExists,
          requireHubActive: this.ctx.config.faq.requireHubActive,
          hubActive,
        }),
      );
      // A full run that sees a status gate change re-maps everything; incremental only edited rows.
      const result = await ingestEntries(
        this.ctx.deps.store,
        this.ctx.deps.embedder,
        mapped.map((m) => m.entry),
        {
          archiveMissingFor: full ? ["faq"] : [],
          repairEmbeddings: full,
          updatedBy: options.actor,
        },
      );
      const summary = {
        ...run,
        finishedAt: this.ctx.deps.now().toISOString(),
        added: result.added,
        updated: result.updated,
        archived: result.archived,
        held: mapped.filter((m) => m.held.length > 0).length,
        skippedUnverified: mapped.filter((m) => !m.verified).length,
        errors: result.errors,
      };
      await this.store.finishSyncRun(summary);
      await this.alertIfNeeded(summary.held, summary.errors.length > 0, run.id);
      return { ...summary, finishedAt: summary.finishedAt };
    } catch (error) {
      const failed = {
        ...run,
        finishedAt: this.ctx.deps.now().toISOString(),
        errors: [error instanceof Error ? error.name : "sync_failed"],
      };
      await this.store.finishSyncRun(failed);
      await this.alertIfNeeded(0, true, run.id);
      return { ...failed, finishedAt: failed.finishedAt };
    }
  }

  private async ingestSnapshot(
    actor: string,
    routeExists: (path: string) => boolean,
  ): Promise<FaqRunSummary> {
    void routeExists;
    const run = await this.store.startSyncRun("faq", "snapshot");
    const entries = this.ports.snapshot.entries({
      requireHubActive: this.ctx.config.faq.requireHubActive,
    });
    const result = await ingestEntries(this.store, this.ctx.deps.embedder, entries, {
      archiveMissingFor: ["faq"],
      repairEmbeddings: true,
      updatedBy: actor,
    });
    const summary = {
      ...run,
      finishedAt: this.ctx.deps.now().toISOString(),
      added: result.added,
      updated: result.updated,
      archived: result.archived,
      held: this.ports.snapshot.held.length,
      skippedUnverified: this.ports.snapshot.needsConfirmation.length,
      errors: result.errors,
    };
    await this.store.finishSyncRun(summary);
    return { ...summary, finishedAt: summary.finishedAt };
  }

  /** One in-app notice when a run holds entries or the sync fails twice in a row. */
  private async alertIfNeeded(held: number, failed: boolean, runId: string): Promise<void> {
    const runs = (await this.store.lastSyncRuns("faq", 2)).filter((r) => r.mode !== "snapshot");
    const consecutiveFailures = runs.filter((r) => r.errors.length > 0).length;
    if (held === 0 && !(failed && consecutiveFailures >= 2)) return;
    const counts = await this.store.inboxCounts();
    await this.ctx.deps.notifier.send({
      type: "faq.attention",
      counts: { needs: counts.needs, live: counts.live },
      data: { held, consecutiveFailures, runId },
    });
  }
}
