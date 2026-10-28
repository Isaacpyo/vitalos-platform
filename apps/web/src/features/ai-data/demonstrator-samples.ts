import { formatPence } from "./demo-labels";
import type { DemoRawLine, DemoSample } from "./demo-labels";
import {
  exampleCustomer,
  exampleStatementDate,
  exampleSupplier,
  reconciliationRows,
  statedClosingBalance,
  statementLines,
} from "./demonstrator-example";
import type { StatementLine } from "./demonstrator-example";

/**
 * The three SYNTHETIC samples the demonstrator offers. All companies are fictional and say so.
 *
 * - `month-end`: the hand-prepared illustration the page has always shown (demonstrator-example.ts).
 * - `missing-mismatch` and `clean-printed`: taken line for line from evaluation dataset v1
 *   (superadmin/apps/recon_demo/datasets/v1/dev/d03 and d02), so the page shows inputs the
 *   evaluation actually ran on. The results listed here follow that dataset's expected.json.
 *
 * Results are prepared by hand from those inputs. The page says so: it is a scripted example of
 * the output, not a recording of a live run. Amounts are integer pence.
 */

const money = (pence: number) => formatPence(pence).replace("£", "");

const statementText = (line: StatementLine): string => {
  const columns = [line.date, line.reference.padEnd(10), line.details.padEnd(24)];
  const debit = line.type === "invoice" ? money(line.amount) : "";
  const credit = line.type === "payment" || line.type === "credit" ? money(line.amount) : "";
  return `${columns.join(" ")} ${debit.padStart(10)} ${credit.padStart(10)} ${money(line.balance).padStart(10)}`;
};

const monthEndRaw: DemoRawLine[] = [
  { n: 1, text: exampleSupplier.toUpperCase() },
  { n: 2, text: `Customer: ${exampleCustomer}` },
  { n: 3, text: `Statement date: ${exampleStatementDate}` },
  ...statementLines.map((line) => ({ n: line.line, text: statementText(line) })),
  {
    n: statedClosingBalance.line,
    text: `Closing balance${money(statedClosingBalance.amount).padStart(61)}`,
  },
];

const monthEnd: DemoSample = {
  id: "month-end",
  title: "Month-end statement",
  summary: "Eight lines, a duplicate, an amount difference and a missing invoice.",
  origin: "Hand-prepared synthetic illustration of the output format.",
  supplier: exampleSupplier,
  format: "Printed layout",
  sourceTitle: "Statement of account",
  raw: monthEndRaw,
  rows: reconciliationRows.map((row) => ({
    id: `l${row.line}`,
    line: row.line,
    reference: row.reference,
    statementAmount: row.statementAmount,
    ledgerAmount: row.ledgerAmount,
    status: row.status,
    review: row.review,
    note: row.note,
  })),
  closing: { line: statedClosingBalance.line, stated: 291055, recomputed: 291055 },
};

const missingMismatch: DemoSample = {
  id: "missing-mismatch",
  title: "Missing invoice and amount difference",
  summary: "A CSV export with three exceptions, one of them only in the ledger.",
  origin: "Synthetic. Input from evaluation dataset v1, case d03.",
  supplier: "Bramblewood Catering Supplies (fictional)",
  format: "CSV export",
  sourceTitle: "Statement of account (CSV)",
  raw: [
    { n: 1, text: "Statement of account - Bramblewood Catering Supplies (fictional)" },
    { n: 2, text: "Account,BCS-2209" },
    { n: 3, text: "Date,Reference,Type,Amount,Balance" },
    { n: 4, text: "2026-10-01,,Opening balance,2000.00,2000.00" },
    { n: 5, text: "2026-10-01,INV-3101,Invoice,820.00,2820.00" },
    { n: 6, text: "2026-10-06,INV-3102,Invoice,1440.00,4260.00" },
    { n: 7, text: "2026-10-09,INV-3103,Invoice,96.50,4356.50" },
    { n: 8, text: "2026-10-14,PAY-3104,Payment,2000.00,2356.50" },
    { n: 9, text: "2026-10-20,INV-3105,Invoice,512.30,2868.80" },
    { n: 10, text: ",,Closing balance,2868.80," },
  ],
  rows: [
    {
      id: "l5",
      line: 5,
      reference: "INV-3101",
      statementAmount: 82000,
      ledgerAmount: 82000,
      status: "matched",
      review: false,
      note: "Agrees with the ledger.",
    },
    {
      id: "l6",
      line: 6,
      reference: "INV-3102",
      statementAmount: 144000,
      ledgerAmount: 140400,
      status: "amount-mismatch",
      review: true,
      note: "Statement £1,440.00, ledger £1,404.00: a difference of £36.00 (digits transposed).",
    },
    {
      id: "l7",
      line: 7,
      reference: "INV-3103",
      statementAmount: 9650,
      ledgerAmount: null,
      status: "missing",
      review: true,
      note: "No entry in the purchase-ledger export.",
    },
    {
      id: "l8",
      line: 8,
      reference: "PAY-3104",
      statementAmount: 200000,
      ledgerAmount: 200000,
      status: "matched",
      review: false,
      note: "Payment agrees with the ledger.",
    },
    {
      id: "l9",
      line: 9,
      reference: "INV-3105",
      statementAmount: 51230,
      ledgerAmount: 51230,
      status: "matched",
      review: false,
      note: "Agrees with the ledger.",
    },
    {
      id: "ledger-inv-3199",
      line: null,
      reference: "INV-3199",
      statementAmount: null,
      ledgerAmount: 23000,
      status: "not-on-statement",
      review: true,
      note: "In the ledger (£230.00, dated 27 October) but not on the statement.",
    },
  ],
  closing: { line: 10, stated: 286880, recomputed: 286880 },
};

const cleanPrinted: DemoSample = {
  id: "clean-printed",
  title: "Clean printed statement",
  summary: "A fixed-width printed layout where every line agrees. No exceptions.",
  origin: "Synthetic. Input from evaluation dataset v1, case d02.",
  supplier: "Northgate Office Supplies (fictional)",
  format: "Printed layout",
  sourceTitle: "Statement of account (printed)",
  raw: [
    { n: 1, text: "NORTHGATE OFFICE SUPPLIES (FICTIONAL)" },
    { n: 2, text: "Unit 4, Example Trading Estate, Exampletown EX1 1AA" },
    { n: 3, text: "STATEMENT OF ACCOUNT          Account: NOS-7731" },
    { n: 4, text: "" },
    { n: 5, text: "Date        Ref        Details                  Debit    Credit   Balance" },
    { n: 6, text: "01/09/2026  B/F        Balance brought forward                      640.00" },
    { n: 7, text: "02/09/2026  INV-2001   Invoice                2,340.00            2,980.00" },
    { n: 8, text: "09/09/2026  INV-2002   Invoice                  118.75            3,098.75" },
    { n: 9, text: "15/09/2026  PAY-2003   Payment received - BACS         1,500.00   1,598.75" },
    { n: 10, text: "22/09/2026  INV-2004   Invoice                1,062.10            2,660.85" },
    { n: 11, text: "29/09/2026  CN-2005    Credit note - damaged item     18.75      2,642.10" },
    { n: 12, text: "" },
    { n: 13, text: "                      Closing balance                            2,642.10" },
  ],
  rows: [
    ["l7", 7, "INV-2001", 234000, "Agrees with the ledger."],
    ["l8", 8, "INV-2002", 11875, "Agrees with the ledger."],
    ["l9", 9, "PAY-2003", 150000, "Payment agrees with the ledger."],
    ["l10", 10, "INV-2004", 106210, "Agrees with the ledger."],
    ["l11", 11, "CN-2005", 1875, "Credit note agrees with the ledger."],
  ].map(([id, line, reference, amount, note]) => ({
    id: id as string,
    line: line as number,
    reference: reference as string,
    statementAmount: amount as number,
    ledgerAmount: amount as number,
    status: "matched" as const,
    review: false,
    note: note as string,
  })),
  closing: { line: 13, stated: 264210, recomputed: 264210 },
};

export const demoSamples: readonly DemoSample[] = [monthEnd, missingMismatch, cleanPrinted];
