"use client";

import { useId, useState } from "react";
import { CopyButton } from "@vitalos/ui/interactive";
import { Icon } from "@vitalos/ui";
import {
  demoStatusExplanations,
  demoStatusLabels,
  finalState,
  formatPence,
} from "../../features/ai-data/demo-labels";
import type { DemoRow, DemoSample } from "../../features/ai-data/demo-labels";
import { ExplainButton, ReviewerTaskButton } from "./lazy-overlays";
import { track } from "./track";
import type { OverlayTone } from "./overlays-impl";
import { Expand, ScriptedLabels, SourceLines, StatusBadge, cx } from "./work-surface";

/**
 * The reconciliation work surface. Source document beside the extracted results, matched items
 * and exceptions marked, evidence that expands, and a split between what code, a model and a
 * reviewer each do. A SCRIPTED example on SYNTHETIC data: the results are prepared from the
 * sample input, nothing is computed live and no model is called. It says so on the surface.
 *
 * `variant="preview"` is the compact form used on the home page (results and evidence only);
 * `"full"` adds the source document, the sample picker, explanation popovers and the reviewer
 * drawer. Popovers and the drawer load on demand (lazy-overlays.tsx).
 */

type Filter = "all" | "review";
export type WorkbenchSurface = "preview" | "demonstrator" | "expanded";

const lineId = (n: number) => `l${n}`;

function resultJson(sample: DemoSample): string {
  return JSON.stringify(
    {
      synthetic: true,
      scripted: true,
      sample: sample.id,
      supplier: sample.supplier,
      finalState: finalState(sample),
      closingBalanceAgrees: sample.closing.stated === sample.closing.recomputed,
      results: sample.rows.map((row) => ({
        reference: row.reference,
        sourceLine: row.line,
        statementPence: row.statementAmount,
        ledgerPence: row.ledgerAmount,
        status: row.status,
        route: row.review ? "reviewer" : "accepted",
        note: row.note,
      })),
    },
    null,
    2,
  );
}

function Evidence({
  row,
  sample,
  tone,
  full,
}: Readonly<{ row: DemoRow; sample: DemoSample; tone: OverlayTone; full: boolean }>) {
  const source = row.line === null ? undefined : sample.raw.find((l) => l.n === row.line);
  return (
    <div className="flex flex-col gap-(--space-3) border-t border-aid-border px-(--space-3) py-(--space-3)">
      <dl className="m-0 grid gap-(--space-3) text-small sm:grid-cols-3">
        <div>
          <dt className="text-aid-muted">On the statement</dt>
          <dd className="m-0 font-mono font-semibold text-aid-heading">
            {row.statementAmount === null ? "Not listed" : formatPence(row.statementAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-aid-muted">In the ledger</dt>
          <dd className="m-0 font-mono font-semibold text-aid-heading">
            {row.ledgerAmount === null ? "No entry" : formatPence(row.ledgerAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-aid-muted">Route</dt>
          <dd className="m-0 font-semibold text-aid-heading">
            {row.review ? "To a reviewer" : "Accepted"}
          </dd>
        </div>
      </dl>
      <p className="m-0 text-aid-text">{row.note}</p>
      <p className="m-0 text-small text-aid-muted">{demoStatusExplanations[row.status]}</p>
      {source ? (
        <SourceLines
          label={`Cited source: line ${source.n}`}
          marked={[lineId(source.n)]}
          lines={[{ id: lineId(source.n), n: source.n, text: source.text }]}
        />
      ) : (
        <p className="m-0 text-small text-aid-muted">
          No statement line: this item is only in the ledger.
        </p>
      )}
      {full && row.review ? (
        <div>
          <ReviewerTaskButton row={row} statement={source?.text} money={formatPence} tone={tone} />
        </div>
      ) : null}
    </div>
  );
}

export function ReconWorkbench({
  samples,
  defaultSampleId,
  surface,
  variant = "full",
  tone = "light",
}: Readonly<{
  samples: readonly DemoSample[];
  defaultSampleId?: string;
  surface: WorkbenchSurface;
  variant?: "preview" | "full";
  /** The tone of the band this sits in, passed to portalled overlays. */
  tone?: OverlayTone;
}>) {
  const baseId = useId();
  const full = variant === "full";
  const first = samples[0];
  const [sampleId, setSampleId] = useState(defaultSampleId ?? first?.id ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const sample = samples.find((s) => s.id === sampleId) ?? first;
  if (!sample) return null;

  const reviewCount = sample.rows.filter((row) => row.review).length;
  const matched = sample.rows.length - reviewCount;
  const agrees = sample.closing.stated === sample.closing.recomputed;
  const rows = filter === "review" ? sample.rows.filter((r) => r.review) : sample.rows;
  const selected = sample.rows.find((r) => r.id === openId);
  const marked = selected?.line ? [lineId(selected.line)] : [];
  const flagged = sample.rows.flatMap((r) => (r.review && r.line ? [lineId(r.line)] : []));

  const chooseSample = (next: DemoSample) => {
    if (next.id === sample.id) return;
    setSampleId(next.id);
    setOpenId(null);
    setFilter("all");
    const exceptions = next.rows.filter((r) => r.review).length;
    setAnnounce(
      `${next.title}: ${next.rows.length - exceptions} matched, ${exceptions} for review.`,
    );
    track("demo_sample_chosen", { surface, sampleId: next.id });
  };

  const toggleRow = (row: DemoRow) => {
    const next = openId === row.id ? null : row.id;
    setOpenId(next);
    if (next) track("demo_evidence_expanded", { surface, sampleId: sample.id, itemId: row.id });
  };

  return (
    <div className="flex min-w-0 flex-col gap-(--space-5)">
      <div className="flex flex-col gap-(--space-3)">
        <ScriptedLabels />
        {full ? (
          <p className="m-0 max-w-(--container-prose) text-small text-aid-muted">
            The inputs are synthetic. The results below were prepared from them and are shown as the
            demonstrator would present them: this is a scripted example, not a live run, and no
            model is called.
          </p>
        ) : null}
      </div>

      {samples.length > 1 ? (
        <div className="flex flex-col gap-(--space-2)">
          <p id={`${baseId}-pick`} className="m-0 text-small font-semibold text-aid-heading">
            Choose a synthetic sample
          </p>
          <div
            role="group"
            aria-labelledby={`${baseId}-pick`}
            className="grid gap-(--space-2) md:grid-cols-3"
          >
            {samples.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === sample.id}
                onClick={() => chooseSample(s)}
                className={cx(
                  "flex min-h-11 flex-col items-start gap-(--space-1) rounded-lg border p-(--space-3) text-left transition-[border-color,box-shadow,transform] duration-(--duration-feedback) active:translate-y-px",
                  s.id === sample.id
                    ? "border-aid-signal bg-aid-signal-soft shadow-floating"
                    : "border-aid-border bg-aid-surface hover:border-aid-line hover:shadow-floating",
                )}
              >
                <span className="font-semibold text-aid-heading">{s.title}</span>
                <span className="text-small text-aid-muted">{s.summary}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <dl className="m-0 grid grid-cols-2 gap-(--space-3) lg:grid-cols-4">
        <div className="rounded-lg border border-aid-border bg-aid-surface p-(--space-3)">
          <dt className="text-small text-aid-muted">Matched</dt>
          <dd className="m-0 text-h3 font-semibold text-aid-heading">{matched}</dd>
        </div>
        <div className="rounded-lg border border-aid-border bg-aid-surface p-(--space-3)">
          <dt className="text-small text-aid-muted">For review</dt>
          <dd className="m-0 text-h3 font-semibold text-aid-heading">{reviewCount}</dd>
        </div>
        <div className="rounded-lg border border-aid-border bg-aid-surface p-(--space-3)">
          <dt className="flex items-center justify-between gap-(--space-1) text-small text-aid-muted">
            Closing balance
            {full ? (
              <ExplainButton
                label="About the closing balance check"
                title="Closing balance check"
                text="Plain code recomputes the closing balance from the opening balance and every line, in exact pence, and compares it with the figure printed on the statement. No model is involved."
                tone={tone}
              />
            ) : null}
          </dt>
          <dd className="m-0 font-semibold text-aid-heading">
            {agrees ? "Agrees" : "Does not agree"}
            <span className="block font-mono text-small font-normal text-aid-muted">
              {formatPence(sample.closing.recomputed)} recomputed
            </span>
          </dd>
        </div>
        <div className="rounded-lg border border-aid-border bg-aid-surface p-(--space-3)">
          <dt className="flex items-center justify-between gap-(--space-1) text-small text-aid-muted">
            Final state
            {full ? (
              <ExplainButton
                label="About the final state"
                title="Final state"
                text="A run is COMPLETED only when nothing needs a person. Any exception or uncertainty makes it REVIEW_REQUIRED, with the reason for each item. Nothing is posted to the accounts automatically."
                tone={tone}
              />
            ) : null}
          </dt>
          <dd className="m-0 font-mono font-semibold text-aid-heading">{finalState(sample)}</dd>
        </div>
      </dl>

      <div
        className={cx(
          "grid min-w-0 gap-(--space-5)",
          full && "lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]",
        )}
      >
        {full ? (
          <section
            aria-labelledby={`${baseId}-src`}
            className="flex min-w-0 flex-col gap-(--space-2) lg:sticky lg:top-24 lg:self-start"
          >
            <h3
              id={`${baseId}-src`}
              className="m-0 flex items-center gap-(--space-2) text-body font-semibold text-aid-heading"
            >
              <Icon name="document" size={20} className="shrink-0 text-aid-muted" />
              Source: {sample.sourceTitle}
            </h3>
            <p className="m-0 text-small text-aid-muted">
              {sample.supplier}. {sample.format}. {sample.origin} A <strong>!</strong> marks a line
              behind an exception; the highlighted line is the one whose result is open.
            </p>
            <SourceLines
              label="Statement source, line by line"
              marked={marked}
              flagged={flagged}
              lines={sample.raw.map((l) => ({ id: lineId(l.n), n: l.n, text: l.text }))}
              className="max-h-[30rem] overflow-y-auto"
            />
          </section>
        ) : null}

        <section
          aria-labelledby={`${baseId}-res`}
          className="flex min-w-0 flex-col gap-(--space-3)"
        >
          <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
            <h3
              id={`${baseId}-res`}
              className="m-0 flex items-center gap-(--space-2) text-body font-semibold text-aid-heading"
            >
              <Icon name="table" size={20} className="shrink-0 text-aid-muted" />
              Result
            </h3>
            <div role="group" aria-label="Show" className="flex gap-(--space-1)">
              {(
                [
                  ["all", `All ${sample.rows.length}`],
                  ["review", `Exceptions ${reviewCount}`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cx(
                    "min-h-11 rounded-md border px-(--space-3) text-small font-semibold transition-colors duration-(--duration-feedback)",
                    filter === value
                      ? "border-aid-signal bg-aid-signal-soft text-aid-heading"
                      : "border-aid-border text-aid-muted hover:border-aid-line hover:text-aid-heading",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="m-0 rounded-lg border border-aid-border bg-aid-surface p-(--space-4) text-aid-muted">
              No exceptions in this sample: every line agrees with the ledger.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-(--space-2) p-0">
              {rows.map((row) => {
                const open = openId === row.id;
                return (
                  <li
                    key={row.id}
                    data-status={row.status}
                    className={cx(
                      "rounded-lg border bg-aid-surface transition-[border-color,box-shadow] duration-(--duration-feedback)",
                      open
                        ? "border-aid-signal shadow-floating"
                        : "border-aid-border hover:border-aid-line hover:shadow-floating",
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`${baseId}-ev-${row.id}`}
                      onClick={() => toggleRow(row)}
                      className="flex min-h-11 w-full items-start gap-(--space-3) rounded-lg px-(--space-3) py-(--space-3) text-left"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-(--space-1) sm:flex-row sm:items-center sm:justify-between sm:gap-(--space-3)">
                        <span className="flex min-w-0 flex-wrap items-baseline gap-x-(--space-3)">
                          <span className="font-mono font-semibold text-aid-heading">
                            {row.reference}
                          </span>
                          <span className="text-small text-aid-muted">
                            {row.line === null ? "Ledger only" : `Line ${row.line}`}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-(--space-3)">
                          <span className="font-mono text-small text-aid-text">
                            {formatPence(row.statementAmount ?? row.ledgerAmount ?? 0)}
                          </span>
                          <StatusBadge status={row.status} />
                        </span>
                      </span>
                      <Icon
                        name="chevron-down"
                        size={16}
                        className={cx(
                          "mt-1.5 shrink-0 text-aid-muted transition-transform duration-(--duration-disclosure) ease-(--ease-standard)",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    <Expand id={`${baseId}-ev-${row.id}`} open={open}>
                      <Evidence row={row} sample={sample} tone={tone} full={full} />
                    </Expand>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="m-0 text-small text-aid-muted">
            Statuses: {Object.values(demoStatusLabels).join(", ")}. Choose a result to see the
            evidence behind it.
          </p>
          {full ? (
            <div className="flex flex-wrap items-center gap-(--space-3)">
              <CopyButton
                value={() => resultJson(sample)}
                label="Copy result as JSON"
                copiedLabel="Result copied"
                toast
              />
              <span className="text-small text-aid-muted">
                The structured output a downstream system would receive.
              </span>
            </div>
          ) : null}
        </section>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
