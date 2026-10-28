import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  reconciliationRows,
  recomputedClosingBalance,
  statedClosingBalance,
  statementLines,
} from "../../features/ai-data/demonstrator-example";
import {
  demonstratorReport,
  parseDemonstratorReport,
} from "../../features/ai-data/demonstrator-report";
import type { DemonstratorReport } from "../../features/ai-data/demonstrator-report";
import {
  EvaluationResults,
  ReconciliationTable,
  SIMULATED_LABEL,
  StatementExcerpt,
} from "./demonstrator";

const published = {
  schemaVersion: 1,
  status: "published",
  generatedAt: "2026-10-28T12:00:00Z",
  gitSha: "0123456789abcdef0123456789abcdef01234567",
  datasetVersion: "v1",
  label: "Offline evaluation on synthetic data",
  configs: [
    {
      id: "parser-only",
      label: "Deterministic parser only",
      simulated: false,
      metrics: {
        cases: 24,
        fieldAccuracy: 1,
        lineRecall: 1,
        linePrecision: 1,
        exceptionRecall: 1,
        exceptionPrecision: 0.96,
        stateAccuracy: 1,
        unsafeAccepts: 0,
        p95DurationMs: 41.2,
        costPerCaseGbp: 0,
      },
    },
    {
      id: "simulated-hallucination",
      label: "Model path, hallucinating responses",
      simulated: true,
      metrics: {
        cases: 6,
        fieldAccuracy: 0.5,
        lineRecall: 0.5,
        linePrecision: 1,
        exceptionRecall: 1,
        exceptionPrecision: 1,
        stateAccuracy: 1,
        unsafeAccepts: 0,
        p95DurationMs: 55,
        costPerCaseGbp: 0.0004,
      },
    },
  ],
  criteria: [
    {
      id: "AC-3",
      title: "Grounding: no unsafe accepts",
      threshold: "0",
      result: "pass",
      detail: "0 unsafe accepts across all configurations.",
    },
    {
      id: "AC-14",
      title: "Live provider",
      threshold: "Not run until AI_DATA_LLM_API_KEY is set",
      result: "not-run",
      detail: "No live provider key is configured.",
    },
  ],
} as const;

describe("demonstrator report contract", () => {
  it("the committed report is valid and pending until a real run writes it", () => {
    expect(demonstratorReport.status).toBe("pending");
    expect(demonstratorReport.configs).toEqual([]);
  });

  it("accepts a published report and rejects invented or malformed figures", () => {
    expect(parseDemonstratorReport(published).status).toBe("published");
    expect(() =>
      parseDemonstratorReport({
        ...published,
        configs: [
          {
            ...published.configs[0],
            metrics: { ...published.configs[0].metrics, fieldAccuracy: 98 },
          },
        ],
      }),
    ).toThrow(/configs\.0\.metrics\.fieldAccuracy/);
    expect(() => parseDemonstratorReport({ ...published, status: "pending" })).toThrow();
    expect(() => parseDemonstratorReport({ ...published, roi: "300%" })).toThrow();
    expect(() => parseDemonstratorReport({ ...published, configs: [] })).toThrow();
  });
});

describe("EvaluationResults", () => {
  it("pending: says plainly that results come after the next run, and shows no figures", () => {
    const html = renderToStaticMarkup(<EvaluationResults report={demonstratorReport} />);
    expect(html).toContain("Evaluation results are published after the next evaluation run.");
    expect(html).not.toContain("<table");
    expect(html).not.toMatch(/\d+(\.\d+)?%/);
  });

  it("published: renders the configurations and criteria, labelling simulated responses", () => {
    const report: DemonstratorReport = parseDemonstratorReport(published);
    const html = renderToStaticMarkup(<EvaluationResults report={report} />);
    expect(html).toContain("Deterministic parser only");
    expect(html).toContain("96.0%");
    expect(html).toContain("0123456789ab");
    // Only the simulated configuration carries the label, and it carries it in full.
    expect(html.split(SIMULATED_LABEL)).toHaveLength(2);
    expect(SIMULATED_LABEL).toMatch(/tests controls, not model quality/i);
    expect(html).toMatch(/AC-14<\/span> <span[^>]*>Live provider/);
    expect(html).toContain("Not run");
    expect(html).toContain("Pass");
  });
});

describe("illustrative example", () => {
  it("is self-consistent: running balances and the stated closing balance add up", () => {
    let balance = statementLines[0]!.balance;
    for (const line of statementLines.slice(1)) {
      balance += line.type === "invoice" ? line.amount : -line.amount;
      expect(line.balance, `line ${line.line}`).toBe(balance);
    }
    expect(recomputedClosingBalance()).toBe(statedClosingBalance.amount);
  });

  it("cites a real statement line for every result and covers each status", () => {
    const lines = new Set(statementLines.map((line) => line.line));
    for (const row of reconciliationRows) expect(lines.has(row.line)).toBe(true);
    expect(new Set(reconciliationRows.map((row) => row.status))).toEqual(
      new Set(["matched", "amount-mismatch", "duplicate", "missing"]),
    );
  });

  it("labels its companies as fictional and renders as accessible tables", () => {
    const html = renderToStaticMarkup(
      <>
        <StatementExcerpt />
        <ReconciliationTable />
      </>,
    );
    expect(html).toContain("Harrow Timber Supplies Ltd (fictional)");
    expect(html).toContain("<caption");
    expect(html).toContain('scope="col"');
    expect(html).toContain("REVIEW_REQUIRED");
    expect(html).toContain("Missing from ledger");
  });
});
