/**
 * The illustrative example on /ai-data/demonstrator: a short SYNTHETIC supplier statement and the
 * reconciliation the demonstrator produces for it (AID-008). Every company is fictional and says
 * so. Amounts are integer pence, so the page and its test do exact arithmetic (the demonstrator
 * itself uses Decimal arithmetic, demonstrator-acceptance.md AC-5).
 *
 * This is a hand-prepared illustration of the output format, not a recorded run and not an
 * evaluation result.
 */

export type StatementLineType = "balance" | "invoice" | "payment" | "credit";

export interface StatementLine {
  /** Source line number in the statement text: the reference every result cites. */
  line: number;
  date: string;
  reference: string;
  details: string;
  type: StatementLineType;
  /** Pence. Invoices are debits; payments and credit notes are credits. */
  amount: number;
  /** Running balance printed on the statement, in pence. */
  balance: number;
}

export type ReconciliationStatus = "matched" | "amount-mismatch" | "duplicate" | "missing";

export interface ReconciliationRow {
  /** The statement line this result comes from. */
  line: number;
  reference: string;
  statementAmount: number;
  /** Pence, or null when the ledger has no entry. */
  ledgerAmount: number | null;
  status: ReconciliationStatus;
  /** True when the row goes to a reviewer. */
  review: boolean;
  note: string;
}

export const exampleSupplier = "Harrow Timber Supplies Ltd (fictional)";
export const exampleCustomer = "Example Joinery Ltd (fictional)";
export const exampleStatementDate = "30/09/2026";

/** Lines 1 to 3 of the statement are its heading; the table starts at line 4. */
export const statementLines: readonly StatementLine[] = [
  {
    line: 4,
    date: "01/09/2026",
    reference: "B/F",
    details: "Balance brought forward",
    type: "balance",
    amount: 0,
    balance: 124000,
  },
  {
    line: 5,
    date: "04/09/2026",
    reference: "INV-40112",
    details: "Invoice",
    type: "invoice",
    amount: 61240,
    balance: 185240,
  },
  {
    line: 6,
    date: "09/09/2026",
    reference: "INV-40127",
    details: "Invoice",
    type: "invoice",
    amount: 38900,
    balance: 224140,
  },
  {
    line: 7,
    date: "12/09/2026",
    reference: "PAY-0912",
    details: "Payment received",
    type: "payment",
    amount: 124000,
    balance: 100140,
  },
  {
    line: 8,
    date: "18/09/2026",
    reference: "INV-40139",
    details: "Invoice",
    type: "invoice",
    amount: 84520,
    balance: 184660,
  },
  {
    line: 9,
    date: "18/09/2026",
    reference: "INV-40139",
    details: "Invoice",
    type: "invoice",
    amount: 84520,
    balance: 269180,
  },
  {
    line: 10,
    date: "23/09/2026",
    reference: "CRN-2207",
    details: "Credit note",
    type: "credit",
    amount: 5600,
    balance: 263580,
  },
  {
    line: 11,
    date: "27/09/2026",
    reference: "INV-40151",
    details: "Invoice",
    type: "invoice",
    amount: 27475,
    balance: 291055,
  },
];

/** Line 12: the closing balance the statement states, in pence. */
export const statedClosingBalance = { line: 12, amount: 291055 } as const;

export const reconciliationRows: readonly ReconciliationRow[] = [
  {
    line: 5,
    reference: "INV-40112",
    statementAmount: 61240,
    ledgerAmount: 61240,
    status: "matched",
    review: false,
    note: "Agrees with the ledger.",
  },
  {
    line: 6,
    reference: "INV-40127",
    statementAmount: 38900,
    ledgerAmount: 39800,
    status: "amount-mismatch",
    review: true,
    note: "Ledger shows £398.00: a difference of £9.00.",
  },
  {
    line: 7,
    reference: "PAY-0912",
    statementAmount: 124000,
    ledgerAmount: 124000,
    status: "matched",
    review: false,
    note: "Payment agrees with the ledger.",
  },
  {
    line: 8,
    reference: "INV-40139",
    statementAmount: 84520,
    ledgerAmount: 84520,
    status: "matched",
    review: false,
    note: "Agrees with the ledger.",
  },
  {
    line: 9,
    reference: "INV-40139",
    statementAmount: 84520,
    ledgerAmount: null,
    status: "duplicate",
    review: true,
    note: "Same reference and amount as line 8.",
  },
  {
    line: 10,
    reference: "CRN-2207",
    statementAmount: 5600,
    ledgerAmount: 5600,
    status: "matched",
    review: false,
    note: "Credit note agrees with the ledger.",
  },
  {
    line: 11,
    reference: "INV-40151",
    statementAmount: 27475,
    ledgerAmount: null,
    status: "missing",
    review: true,
    note: "No entry in the purchase-ledger export.",
  },
];

export const statusLabels: Record<ReconciliationStatus, string> = {
  matched: "Matched",
  "amount-mismatch": "Amount mismatch",
  duplicate: "Duplicate",
  missing: "Missing from ledger",
};

/** Signed movement of a line on the balance: invoices add, payments and credits reduce. */
export const movement = (line: StatementLine): number =>
  line.type === "invoice" ? line.amount : line.type === "balance" ? 0 : -line.amount;

/** Recomputes the closing balance from the opening balance and the movements (exact, pence). */
export function recomputedClosingBalance(lines: readonly StatementLine[] = statementLines): number {
  const [opening, ...rest] = lines;
  return rest.reduce((total, line) => total + movement(line), opening?.balance ?? 0);
}

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** £1,234.56 from pence. */
export const formatPence = (pence: number): string => pounds.format(pence / 100);
