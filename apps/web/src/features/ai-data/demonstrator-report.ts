import { z } from "zod";
import rawReport from "./demonstrator-report.json";

/**
 * The supplier statement reconciliation demonstrator's offline evaluation report (AID-008,
 * docs/ai-data/engineering/demonstrator-acceptance.md), as published on /ai-data/demonstrator.
 *
 * `demonstrator-report.json` is written by the Super Admin's `recon_eval` command after a real
 * evaluation run (docs/ai-data/PLAN.md "Shared contracts"). Until then it says
 * `"status": "pending"` and the page says so; no figure is ever invented here.
 *
 * Contract (schemaVersion 1): rates (`fieldAccuracy`, `lineRecall`, `linePrecision`,
 * `exceptionRecall`, `exceptionPrecision`, `stateAccuracy`) are fractions from 0 to 1;
 * `unsafeAccepts` and `cases` are counts; `p95DurationMs` is milliseconds; `costPerCaseGbp` is
 * pounds. The file is parsed when this module loads, so an invalid report fails the build rather
 * than rendering wrong numbers.
 */

const rate = z.number().min(0).max(1);
const count = z.number().int().nonnegative();

export const demonstratorMetricsSchema = z
  .object({
    cases: count,
    fieldAccuracy: rate,
    lineRecall: rate,
    linePrecision: rate,
    exceptionRecall: rate,
    exceptionPrecision: rate,
    stateAccuracy: rate,
    unsafeAccepts: count,
    p95DurationMs: z.number().nonnegative(),
    costPerCaseGbp: z.number().nonnegative(),
  })
  .strict();

export const demonstratorConfigSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(160),
    /** True when model responses are hand-written test doubles (tests controls, not quality). */
    simulated: z.boolean(),
    metrics: demonstratorMetricsSchema,
  })
  .strict();

export const criterionResults = ["pass", "fail", "not-run"] as const;

export const demonstratorCriterionSchema = z
  .object({
    id: z.string().regex(/^AC-\d{1,2}$/),
    title: z.string().min(1).max(300),
    threshold: z.string().min(1).max(160),
    result: z.enum(criterionResults),
    detail: z.string().max(600),
  })
  .strict();

const common = {
  schemaVersion: z.literal(1),
  datasetVersion: z.string().min(1).max(20),
  label: z.string().min(1).max(160),
};

export const demonstratorReportSchema = z.discriminatedUnion("status", [
  z
    .object({
      ...common,
      status: z.literal("pending"),
      generatedAt: z.null(),
      gitSha: z.null(),
      configs: z.array(demonstratorConfigSchema).max(0),
      criteria: z.array(demonstratorCriterionSchema).max(0),
    })
    .strict(),
  z
    .object({
      ...common,
      status: z.literal("published"),
      generatedAt: z.iso.datetime({ offset: true }),
      gitSha: z.string().regex(/^[0-9a-f]{7,40}$/),
      configs: z.array(demonstratorConfigSchema).min(1),
      criteria: z.array(demonstratorCriterionSchema).min(1),
    })
    .strict(),
]);

export type DemonstratorReport = z.infer<typeof demonstratorReportSchema>;
export type DemonstratorConfig = z.infer<typeof demonstratorConfigSchema>;
export type DemonstratorCriterion = z.infer<typeof demonstratorCriterionSchema>;

/** Parses a report, throwing with the failing paths (never the values) when it is invalid. */
export function parseDemonstratorReport(value: unknown): DemonstratorReport {
  const parsed = demonstratorReportSchema.safeParse(value);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)");
    throw new Error(`demonstrator-report.json is invalid at: ${[...new Set(paths)].join(", ")}`);
  }
  return parsed.data;
}

/** The committed report, validated at module load (build time for the static page). */
export const demonstratorReport: DemonstratorReport = parseDemonstratorReport(rawReport);
