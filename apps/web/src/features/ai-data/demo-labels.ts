/**
 * Types, labels and small helpers shared by the demonstrator surfaces. Kept apart from the sample
 * data (demonstrator-samples.ts) so client islands that only need a label do not bundle the
 * sample statements: the home page ships none of them to the browser.
 */

export type DemoStatus =
  "matched" | "amount-mismatch" | "duplicate" | "missing" | "not-on-statement";

export const demoStatusLabels: Record<DemoStatus, string> = {
  matched: "Matched",
  "amount-mismatch": "Amount mismatch",
  duplicate: "Duplicate",
  missing: "Missing from ledger",
  "not-on-statement": "Not on statement",
};

/** Why a reviewer sees each kind of exception. */
export const demoStatusExplanations: Record<DemoStatus, string> = {
  matched:
    "The reference and amount agree between the statement and the ledger, so no one needs to look at it.",
  "amount-mismatch":
    "The same reference appears in both, but the amounts differ. Code finds the difference exactly; a person decides which side is right.",
  duplicate:
    "The statement lists the same reference and amount twice. Only a person can tell whether the supplier made a mistake or you were invoiced twice.",
  missing:
    "The statement has a line the purchase ledger does not. It may be an invoice that was never entered, or one that should not be paid.",
  "not-on-statement":
    "The ledger holds an item the statement does not list. It may be entered too early, or the supplier may have missed it.",
};

export interface DemoRawLine {
  /** Line number in the source text: the reference every result cites. */
  n: number;
  text: string;
}

export interface DemoRow {
  /** Stable id used in analytics and element ids: `l6`, or `ledger-inv-3199` for a ledger-only item. */
  id: string;
  /** Statement line, or null for an item that is only in the ledger. */
  line: number | null;
  reference: string;
  statementAmount: number | null;
  ledgerAmount: number | null;
  status: DemoStatus;
  review: boolean;
  note: string;
}

export interface DemoSample {
  id: string;
  title: string;
  summary: string;
  /** Where the input comes from, stated plainly. */
  origin: string;
  supplier: string;
  format: string;
  sourceTitle: string;
  raw: readonly DemoRawLine[];
  rows: readonly DemoRow[];
  closing: { line: number; stated: number; recomputed: number };
}

export const finalState = (sample: DemoSample): "REVIEW_REQUIRED" | "COMPLETED" =>
  sample.rows.some((row) => row.review) ? "REVIEW_REQUIRED" : "COMPLETED";

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** £1,234.56 from pence. */
export const formatPence = (pence: number): string => pounds.format(pence / 100);
