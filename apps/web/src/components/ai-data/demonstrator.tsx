import type { ReactNode } from "react";
import {
  exampleCustomer,
  exampleStatementDate,
  exampleSupplier,
  formatPence,
  reconciliationRows,
  recomputedClosingBalance,
  statedClosingBalance,
  statementLines,
  statusLabels,
} from "../../features/ai-data/demonstrator-example";
import type { ReconciliationStatus } from "../../features/ai-data/demonstrator-example";
import type {
  DemonstratorConfig,
  DemonstratorCriterion,
  DemonstratorReport,
} from "../../features/ai-data/demonstrator-report";

/**
 * Demonstrator page pieces: the synthetic statement excerpt, its reconciliation and the offline
 * evaluation results. Tables are real HTML tables with captions and header scopes; on narrow
 * screens each scrolls inside its own focusable region instead of widening the page.
 */

const statusTone: Record<ReconciliationStatus, string> = {
  matched: "bg-aid-ok-bg text-aid-ok",
  "amount-mismatch": "bg-aid-warn-bg text-aid-warn",
  duplicate: "bg-aid-warn-bg text-aid-warn",
  missing: "bg-aid-error-bg text-aid-error",
};

function StatusBadge({ status }: Readonly<{ status: ReconciliationStatus }>) {
  return (
    <span
      className={`inline-flex items-center gap-(--space-2) rounded-sm px-(--space-2) py-0.5 text-small font-semibold whitespace-nowrap ${statusTone[status]}`}
    >
      <span aria-hidden="true">{status === "matched" ? "✓" : "!"}</span>
      {statusLabels[status]}
    </span>
  );
}

/**
 * A table that scrolls on its own on narrow screens; keyboard users can focus and scroll it. The
 * title and description sit above the scrolling area so they never scroll out of view; the table
 * repeats the title in a visually hidden caption.
 */
export function TableScroll({
  title,
  description,
  children,
}: Readonly<{ title: string; description?: string; children: ReactNode }>) {
  return (
    <div className="flex min-w-0 flex-col gap-(--space-3)">
      <div className="flex flex-col gap-(--space-1)">
        <p className="m-0 font-semibold text-aid-heading">{title}</p>
        {description ? <p className="m-0 text-small text-aid-muted">{description}</p> : null}
      </div>
      <div
        role="region"
        aria-label={title}
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-lg border border-aid-border bg-aid-surface [overflow-wrap:normal]"
      >
        {children}
      </div>
    </div>
  );
}

const th =
  "border-b border-aid-border px-(--space-4) py-(--space-3) text-left text-small font-semibold text-aid-heading whitespace-nowrap";
const td = "border-b border-aid-border px-(--space-4) py-(--space-3) align-top text-small";
const num = "text-right font-mono tabular-nums whitespace-nowrap";

export function StatementExcerpt() {
  return (
    <TableScroll
      title={`${exampleSupplier}: statement of account`}
      description={`Customer ${exampleCustomer}, statement date ${exampleStatementDate}. Lines 1 to 3 are the statement heading.`}
    >
      <table className="w-full min-w-[46rem] border-collapse">
        <caption className="sr-only">{exampleSupplier}: statement of account</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Line
            </th>
            <th scope="col" className={th}>
              Date
            </th>
            <th scope="col" className={th}>
              Reference
            </th>
            <th scope="col" className={th}>
              Details
            </th>
            <th scope="col" className={`${th} text-right`}>
              Debit
            </th>
            <th scope="col" className={`${th} text-right`}>
              Credit
            </th>
            <th scope="col" className={`${th} text-right`}>
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {statementLines.map((line) => (
            <tr key={line.line}>
              <td className={`${td} font-mono text-aid-muted`}>L{line.line}</td>
              <td className={`${td} whitespace-nowrap`}>{line.date}</td>
              <th scope="row" className={`${td} text-left font-mono font-normal whitespace-nowrap`}>
                {line.reference}
              </th>
              <td className={td}>{line.details}</td>
              <td className={`${td} ${num}`}>
                {line.type === "invoice" ? formatPence(line.amount) : ""}
              </td>
              <td className={`${td} ${num}`}>
                {line.type === "payment" || line.type === "credit" ? formatPence(line.amount) : ""}
              </td>
              <td className={`${td} ${num}`}>{formatPence(line.balance)}</td>
            </tr>
          ))}
          <tr>
            <td className={`${td} font-mono text-aid-muted`}>L{statedClosingBalance.line}</td>
            <td className={td} />
            <th scope="row" className={`${td} text-left font-semibold`} colSpan={4}>
              Closing balance
            </th>
            <td className={`${td} ${num} font-semibold`}>
              {formatPence(statedClosingBalance.amount)}
            </td>
          </tr>
        </tbody>
      </table>
    </TableScroll>
  );
}

export function ReconciliationTable() {
  const recomputed = recomputedClosingBalance();
  const agrees = recomputed === statedClosingBalance.amount;
  const forReview = reconciliationRows.filter((row) => row.review).length;
  return (
    <div className="flex flex-col gap-(--space-4)">
      <TableScroll
        title="Reconciliation against the purchase-ledger export"
        description="Each result cites the statement line it comes from."
      >
        <table className="w-full min-w-[52rem] border-collapse">
          <caption className="sr-only">Reconciliation against the purchase-ledger export</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>
                Source
              </th>
              <th scope="col" className={th}>
                Reference
              </th>
              <th scope="col" className={`${th} text-right`}>
                Statement
              </th>
              <th scope="col" className={`${th} text-right`}>
                Ledger
              </th>
              <th scope="col" className={th}>
                Status
              </th>
              <th scope="col" className={th}>
                Note
              </th>
              <th scope="col" className={th}>
                Route
              </th>
            </tr>
          </thead>
          <tbody>
            {reconciliationRows.map((row) => (
              <tr key={row.line}>
                <td className={`${td} font-mono text-aid-muted`}>L{row.line}</td>
                <th
                  scope="row"
                  className={`${td} text-left font-mono font-normal whitespace-nowrap`}
                >
                  {row.reference}
                </th>
                <td className={`${td} ${num}`}>{formatPence(row.statementAmount)}</td>
                <td className={`${td} ${num}`}>
                  {row.ledgerAmount === null ? (
                    <>
                      <span aria-hidden="true">–</span>
                      <span className="sr-only">No ledger entry</span>
                    </>
                  ) : (
                    formatPence(row.ledgerAmount)
                  )}
                </td>
                <td className={td}>
                  <StatusBadge status={row.status} />
                </td>
                <td className={`${td} min-w-[12rem]`}>{row.note}</td>
                <td className={`${td} whitespace-nowrap font-semibold`}>
                  {row.review ? "Reviewer" : "Accepted"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <dl className="m-0 grid gap-(--space-4) sm:grid-cols-3">
        <div className="rounded-lg border border-aid-border bg-aid-surface p-(--space-4)">
          <dt className="text-small text-aid-muted">Closing balance check (L12)</dt>
          <dd className="m-0 mt-(--space-1) font-semibold text-aid-heading">
            {agrees ? "Agrees" : "Does not agree"}: {formatPence(recomputed)} recomputed
          </dd>
        </div>
        <div className="rounded-lg border border-aid-border bg-aid-surface p-(--space-4)">
          <dt className="text-small text-aid-muted">Items for review</dt>
          <dd className="m-0 mt-(--space-1) font-semibold text-aid-heading">
            {forReview} of {reconciliationRows.length} lines
          </dd>
        </div>
        <div className="rounded-lg border border-aid-border bg-aid-surface p-(--space-4)">
          <dt className="text-small text-aid-muted">Final state</dt>
          <dd className="m-0 mt-(--space-1) font-mono font-semibold text-aid-heading">
            {forReview > 0 ? "REVIEW_REQUIRED" : "COMPLETED"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const pounds = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);

const resultLabels: Record<DemonstratorCriterion["result"], string> = {
  pass: "Pass",
  fail: "Fail",
  "not-run": "Not run",
};

const resultTone: Record<DemonstratorCriterion["result"], string> = {
  pass: "bg-aid-ok-bg text-aid-ok",
  fail: "bg-aid-error-bg text-aid-error",
  "not-run": "bg-aid-info-bg text-aid-info",
};

const metricColumns: { label: string; value: (c: DemonstratorConfig) => string }[] = [
  { label: "Cases", value: (c) => String(c.metrics.cases) },
  { label: "Field accuracy", value: (c) => percent(c.metrics.fieldAccuracy) },
  { label: "Line recall", value: (c) => percent(c.metrics.lineRecall) },
  { label: "Line precision", value: (c) => percent(c.metrics.linePrecision) },
  { label: "Exception recall", value: (c) => percent(c.metrics.exceptionRecall) },
  { label: "Exception precision", value: (c) => percent(c.metrics.exceptionPrecision) },
  { label: "Final state correct", value: (c) => percent(c.metrics.stateAccuracy) },
  { label: "Unsafe accepts", value: (c) => String(c.metrics.unsafeAccepts) },
  { label: "p95 time per case", value: (c) => `${Math.round(c.metrics.p95DurationMs)} ms` },
  { label: "Cost per case", value: (c) => pounds(c.metrics.costPerCaseGbp) },
];

export const SIMULATED_LABEL = "Simulated model responses: tests controls, not model quality";

const generatedOn = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));

/**
 * The offline evaluation, from `demonstrator-report.json`. Pending: an honest statement that
 * results are published after the next run. Published: the configurations and the acceptance
 * criteria exactly as the report states them; simulated configurations are labelled as such.
 */
export function EvaluationResults({ report }: Readonly<{ report: DemonstratorReport }>) {
  if (report.status === "pending") {
    return (
      <div
        role="status"
        className="flex flex-col gap-(--space-2) rounded-lg border border-aid-border bg-aid-surface p-(--space-6)"
      >
        <p className="m-0 font-semibold text-aid-heading">
          Evaluation results are published after the next evaluation run.
        </p>
        <p className="m-0 text-aid-muted">
          The acceptance criteria were written before any evaluation was run. When the{" "}
          {report.label.toLowerCase()} (dataset {report.datasetVersion}) has been run, its results
          appear here exactly as recorded, including any criterion that was missed.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-(--space-6)">
      <p className="m-0 text-aid-muted">
        {report.label}. Dataset {report.datasetVersion}, generated {generatedOn(report.generatedAt)}{" "}
        from commit <code className="font-mono">{report.gitSha.slice(0, 12)}</code>.
      </p>
      <TableScroll title="Results by configuration">
        <table className="w-full min-w-[64rem] border-collapse">
          <caption className="sr-only">Results by configuration</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>
                Configuration
              </th>
              {metricColumns.map((column) => (
                <th key={column.label} scope="col" className={`${th} text-right`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.configs.map((config) => (
              <tr key={config.id}>
                <th scope="row" className={`${td} min-w-[14rem] text-left font-normal`}>
                  <span className="block font-semibold text-aid-heading">{config.label}</span>
                  {config.simulated ? (
                    <span className="mt-(--space-1) block text-aid-muted">{SIMULATED_LABEL}</span>
                  ) : null}
                </th>
                {metricColumns.map((column) => (
                  <td key={column.label} className={`${td} ${num}`}>
                    {column.value(config)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <TableScroll title="Acceptance criteria">
        <table className="w-full min-w-[48rem] border-collapse">
          <caption className="sr-only">Acceptance criteria</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>
                Criterion
              </th>
              <th scope="col" className={th}>
                Threshold
              </th>
              <th scope="col" className={th}>
                Result
              </th>
              <th scope="col" className={th}>
                Detail
              </th>
            </tr>
          </thead>
          <tbody>
            {report.criteria.map((criterion) => (
              <tr key={criterion.id}>
                <th scope="row" className={`${td} min-w-[14rem] text-left font-normal`}>
                  <span className="font-mono text-aid-muted">{criterion.id}</span>{" "}
                  <span className="text-aid-heading">{criterion.title}</span>
                </th>
                <td className={td}>{criterion.threshold}</td>
                <td className={td}>
                  <span
                    className={`inline-flex rounded-sm px-(--space-2) py-0.5 font-semibold whitespace-nowrap ${resultTone[criterion.result]}`}
                  >
                    {resultLabels[criterion.result]}
                  </span>
                </td>
                <td className={`${td} min-w-[14rem] text-aid-muted`}>{criterion.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
