/**
 * Content for the AI & Data home page's workflow surfaces: the four explorer topics, the three
 * scripted hero examples and the three use-case flows. Every person, company, amount and email
 * here is SYNTHETIC and is shown with that label. Nothing is a customer, a measured result or a
 * live model response: the hero walkthroughs are scripted, hand-written examples of the shape of
 * the output (docs/ai-data, ADR-054).
 */

export const workflowTopicSlugs = [
  "finance-reconciliation",
  "document-intake",
  "customer-requests",
  "operational-reporting",
] as const;

export type WorkflowTopic = (typeof workflowTopicSlugs)[number];

export const isWorkflowTopic = (value: string): value is WorkflowTopic =>
  (workflowTopicSlugs as readonly string[]).includes(value);

export interface ExplorerTopic {
  slug: WorkflowTopic;
  /** Short name on the selector. */
  title: string;
  /** One line on the selector: what the work looks like. */
  symptom: string;
  /** The typical pattern, in a sentence or two. */
  pattern: string;
  /** What you might recognise. */
  signs: readonly string[];
  /** What software does. */
  system: string;
  /** What stays with a person. */
  person: string;
  /** Where to see a related working example, if one exists. */
  example?: { label: string; href: string };
}

/** The four topics are shared with the guided brief (`/ai-data/contact?topic=<slug>`). */
export const explorerTopics: readonly ExplorerTopic[] = [
  {
    slug: "finance-reconciliation",
    title: "Reconciling finance records",
    symptom: "Statements, ledgers and payments that never quite agree",
    pattern:
      "Supplier statements arrive as PDFs and exports. Someone re-keys the lines and ticks them off against the ledger, month after month, and the differences are found late.",
    signs: [
      "Month-end reconciliation takes days of careful checking",
      "Duplicates, missing invoices and transposed amounts surface after payment",
      "Only one person knows how the spreadsheet works",
    ],
    system:
      "Reads each statement, checks every figure against its source line, matches it to the ledger with exact arithmetic and lists the exceptions with the reason for each.",
    person:
      "Accepts, corrects or rejects every exception. Nothing is posted to the accounts automatically.",
    example: { label: "See the reconciliation demonstrator", href: "/ai-data/demonstrator" },
  },
  {
    slug: "document-intake",
    title: "Reading documents in",
    symptom: "Invoices, forms and delivery notes typed in by hand",
    pattern:
      "Documents arrive in different layouts by email and post. Fields are copied into a system by hand, then checked by a second person who has to find the same figure again.",
    signs: [
      "The same few fields are re-typed from every document",
      "Errors are only caught when a payment or order goes wrong",
      "Urgent documents wait behind routine ones",
    ],
    system:
      "Reads the fields into a structured record, shows where each came from, runs the checks you already apply (totals, references, known suppliers) and routes the unusual ones.",
    person:
      "Reviews anything flagged, such as changed bank details, and approves what is paid or posted.",
  },
  {
    slug: "customer-requests",
    title: "Handling requests and enquiries",
    symptom: "Messages that arrive everywhere and get answered late",
    pattern:
      "Enquiries come in by email, web form and phone message. Some are answered late, some missed, and nobody can see which ones are waiting or what each needs.",
    signs: [
      "A shared inbox that nobody fully owns",
      "Questions asked again because the first reply missed a detail",
      "No view of what is open, who has it and when it is due",
    ],
    system:
      "Records each request in one place, sorts it by what it needs, spots what is missing and drafts a reply for your team to edit.",
    person: "Decides what is sent and to whom. A draft is a suggestion; no message goes out alone.",
  },
  {
    slug: "operational-reporting",
    title: "Reporting you can trust",
    symptom: "Numbers in five places and a report that takes a day to build",
    pattern:
      "The figures live in several spreadsheets and systems. Each report is assembled by hand, and the totals do not always agree with last month's.",
    signs: [
      "A weekly or monthly report that takes hours to assemble",
      "Different answers to the same question depending on who you ask",
      "No record of where a figure came from",
    ],
    system:
      "Collects the data on a schedule, applies definitions you have agreed and produces reports that show where every number came from, and say so when a source is late.",
    person:
      "Agrees the definitions, reviews what the report flags and decides what the figures mean.",
  },
];

// --- Hero walkthroughs ---------------------------------------------------------------------------

export type HeroStageId = "input" | "extract" | "check" | "review";

export interface HeroStage {
  id: HeroStageId;
  label: string;
  /** What this stage shows, and who does the work in it. */
  summary: string;
  doer: string;
}

export const heroStages: readonly HeroStage[] = [
  {
    id: "input",
    label: "Input",
    summary: "The input exactly as it would arrive. Nothing has been read yet.",
    doer: "Received as is",
  },
  {
    id: "extract",
    label: "Read",
    summary: "Software reads the input into fields. Each field points to the line it came from.",
    doer: "Rules, or AI where the layout is unfamiliar",
  },
  {
    id: "check",
    label: "Check",
    summary: "Ordinary code checks each field against its source and your records. No guessing.",
    doer: "Deterministic code",
  },
  {
    id: "review",
    label: "Review",
    summary: "The structured result, the evidence behind it, and what still needs a person.",
    doer: "A person decides",
  },
];

export interface HeroLine {
  id: string;
  text: string;
}

export interface HeroField {
  id: string;
  label: string;
  value: string;
  lineIds: readonly string[];
  method: "rule" | "ai-assisted";
}

export interface HeroCheck {
  id: string;
  text: string;
  outcome: "pass" | "flag";
  lineIds: readonly string[];
}

export interface HeroTask {
  id: string;
  topic: WorkflowTopic;
  label: string;
  summary: string;
  inputTitle: string;
  lines: readonly HeroLine[];
  fields: readonly HeroField[];
  checks: readonly HeroCheck[];
  result: readonly { label: string; value: string }[];
  state: string;
  decisions: readonly string[];
}

export const heroTasks: readonly HeroTask[] = [
  {
    id: "statement",
    topic: "finance-reconciliation",
    label: "Supplier statement",
    summary: "Match a supplier's statement to your purchase ledger.",
    inputTitle: "Statement of account (synthetic CSV export)",
    lines: [
      { id: "l1", text: "Statement of account - Bramblewood Catering Supplies (fictional)" },
      { id: "l2", text: "Account,BCS-2209" },
      { id: "l3", text: "Date,Reference,Type,Amount,Balance" },
      { id: "l4", text: "2026-10-01,,Opening balance,2000.00,2000.00" },
      { id: "l5", text: "2026-10-01,INV-3101,Invoice,820.00,2820.00" },
      { id: "l6", text: "2026-10-06,INV-3102,Invoice,1440.00,4260.00" },
      { id: "l7", text: "2026-10-09,INV-3103,Invoice,96.50,4356.50" },
      { id: "l8", text: "2026-10-14,PAY-3104,Payment,2000.00,2356.50" },
      { id: "l9", text: "2026-10-20,INV-3105,Invoice,512.30,2868.80" },
      { id: "l10", text: ",,Closing balance,2868.80," },
    ],
    fields: [
      { id: "f1", label: "INV-3101", value: "Invoice £820.00", lineIds: ["l5"], method: "rule" },
      { id: "f2", label: "INV-3102", value: "Invoice £1,440.00", lineIds: ["l6"], method: "rule" },
      { id: "f3", label: "INV-3103", value: "Invoice £96.50", lineIds: ["l7"], method: "rule" },
      { id: "f4", label: "PAY-3104", value: "Payment £2,000.00", lineIds: ["l8"], method: "rule" },
      { id: "f5", label: "INV-3105", value: "Invoice £512.30", lineIds: ["l9"], method: "rule" },
      { id: "f6", label: "Closing balance", value: "£2,868.80", lineIds: ["l10"], method: "rule" },
    ],
    checks: [
      {
        id: "c1",
        text: "Closing balance recomputed from the lines: £2,868.80. Agrees with the statement.",
        outcome: "pass",
        lineIds: ["l4", "l5", "l6", "l7", "l8", "l9", "l10"],
      },
      {
        id: "c2",
        text: "INV-3101, PAY-3104 and INV-3105 agree with the ledger.",
        outcome: "pass",
        lineIds: ["l5", "l8", "l9"],
      },
      {
        id: "c3",
        text: "INV-3102: statement £1,440.00, ledger £1,404.00. Difference £36.00.",
        outcome: "flag",
        lineIds: ["l6"],
      },
      {
        id: "c4",
        text: "INV-3103 (£96.50) is on the statement but not in the ledger.",
        outcome: "flag",
        lineIds: ["l7"],
      },
      {
        id: "c5",
        text: "INV-3199 (£230.00) is in the ledger but not on the statement.",
        outcome: "flag",
        lineIds: [],
      },
    ],
    result: [
      { label: "Matched", value: "3 lines" },
      { label: "Exceptions", value: "3" },
      { label: "Closing balance", value: "Agrees" },
    ],
    state: "REVIEW_REQUIRED",
    decisions: [
      "Is the £36.00 difference on INV-3102 a ledger typo or a supplier error?",
      "Chase or enter INV-3103, which the ledger does not have.",
      "Is INV-3199 a ledger entry made too early, or missing from the statement?",
      "Nothing is posted to the accounts until a person approves it.",
    ],
  },
  {
    id: "invoice",
    topic: "document-intake",
    label: "Supplier invoice",
    summary: "Read an invoice into a checked record, and spot what is unusual.",
    inputTitle: "Supplier invoice (synthetic, text of a PDF)",
    lines: [
      { id: "l1", text: "INVOICE - Calder Fixings Ltd (fictional)" },
      { id: "l2", text: "Invoice no: CF-20417   Date: 14/10/2026" },
      { id: "l3", text: "Your order: PO-5521" },
      { id: "l4", text: "Pay to sort code 00-00-02, account 00000002 (example)" },
      { id: "l5", text: "Fixings pack A x 40 @ 12.50 = 500.00" },
      { id: "l6", text: "Net 500.00" },
      { id: "l7", text: "VAT 20% 100.00" },
      { id: "l8", text: "Total due 600.00" },
    ],
    fields: [
      { id: "f1", label: "Invoice number", value: "CF-20417", lineIds: ["l2"], method: "rule" },
      { id: "f2", label: "Order", value: "PO-5521", lineIds: ["l3"], method: "rule" },
      {
        id: "f3",
        label: "Bank details",
        value: "00-00-02 / 00000002",
        lineIds: ["l4"],
        method: "rule",
      },
      { id: "f4", label: "Net", value: "£500.00", lineIds: ["l6"], method: "rule" },
      { id: "f5", label: "VAT", value: "£100.00", lineIds: ["l7"], method: "rule" },
      { id: "f6", label: "Total due", value: "£600.00", lineIds: ["l8"], method: "rule" },
    ],
    checks: [
      {
        id: "c1",
        text: "Net £500.00 plus VAT £100.00 equals the total of £600.00, to the penny.",
        outcome: "pass",
        lineIds: ["l6", "l7", "l8"],
      },
      {
        id: "c2",
        text: "VAT is 20% of the net amount.",
        outcome: "pass",
        lineIds: ["l6", "l7"],
      },
      {
        id: "c3",
        text: "PO-5521 is an open order for this supplier (synthetic order list).",
        outcome: "pass",
        lineIds: ["l3"],
      },
      {
        id: "c4",
        text: "Bank details differ from the last three invoices from this supplier (00-00-01 / 00000001).",
        outcome: "flag",
        lineIds: ["l4"],
      },
    ],
    result: [
      { label: "Invoice", value: "CF-20417, £600.00" },
      { label: "Checks passed", value: "3 of 4" },
      { label: "Payment", value: "Held for review" },
    ],
    state: "REVIEW_REQUIRED",
    decisions: [
      "Confirm the new bank details with the supplier on a number you already hold.",
      "Approve the invoice for payment. Nothing is paid automatically.",
    ],
  },
  {
    id: "request",
    topic: "customer-requests",
    label: "Customer request",
    summary: "Sort an incoming enquiry, find what is missing and draft a reply.",
    inputTitle: "Incoming email (synthetic)",
    lines: [
      { id: "l1", text: "From: sam.example@customer.example (fictional sender)" },
      { id: "l2", text: "Subject: Quote for replacement doors" },
      { id: "l3", text: "Hi, we need three external doors replaced at our unit," },
      { id: "l4", text: "postcode EX1 1AA (example). Could you quote for supply and" },
      { id: "l5", text: "fit, ideally before the end of November? Sizes are on the" },
      { id: "l6", text: "attached survey. Thanks, Sam" },
    ],
    fields: [
      {
        id: "f1",
        label: "Request type",
        value: "Quote request",
        lineIds: ["l2", "l3"],
        method: "ai-assisted",
      },
      {
        id: "f2",
        label: "Quantity",
        value: "3 external doors",
        lineIds: ["l3"],
        method: "ai-assisted",
      },
      { id: "f3", label: "Postcode", value: "EX1 1AA", lineIds: ["l4"], method: "rule" },
      {
        id: "f4",
        label: "Wanted by",
        value: "before the end of November",
        lineIds: ["l5"],
        method: "ai-assisted",
      },
      {
        id: "f5",
        label: "Attachment",
        value: "Survey mentioned",
        lineIds: ["l5", "l6"],
        method: "ai-assisted",
      },
    ],
    checks: [
      {
        id: "c1",
        text: "The postcode has a valid format.",
        outcome: "pass",
        lineIds: ["l4"],
      },
      {
        id: "c2",
        text: "No open enquiry from this sender (synthetic enquiry list).",
        outcome: "pass",
        lineIds: ["l1"],
      },
      {
        id: "c3",
        text: "The email mentions a survey, but no attachment arrived.",
        outcome: "flag",
        lineIds: ["l5", "l6"],
      },
      {
        id: "c4",
        text: "The date is vague: 'before the end of November' is not a day.",
        outcome: "flag",
        lineIds: ["l5"],
      },
    ],
    result: [
      { label: "Category", value: "Quote request" },
      { label: "Queue", value: "Sales" },
      { label: "Reply", value: "Draft prepared, not sent" },
    ],
    state: "DRAFT_FOR_REVIEW",
    decisions: [
      "Approve or edit the draft reply, which asks for the survey and a date. Nothing is sent until someone does.",
      "Decide whether the timescale can be met.",
    ],
  },
];

export const heroStatement = "Scripted example on synthetic data. Not live AI.";

// --- Use cases -----------------------------------------------------------------------------------

export interface UseCaseFlow {
  id: string;
  title: string;
  input: string;
  assist: string;
  review: string;
  outcome: string;
  href: string;
}

/** Three practical flows. Outcomes are statements of intent, not measured results. */
export const useCaseFlows: readonly UseCaseFlow[] = [
  {
    id: "reconciliation",
    title: "Month-end supplier reconciliation",
    input: "Supplier statements as PDFs and exports, plus a purchase-ledger export.",
    assist:
      "Reads each line, checks it against its source, matches it to the ledger with exact arithmetic.",
    review: "An accountant accepts, corrects or rejects each exception.",
    outcome: "Exceptions in hours, not a day of ticking lines off.",
    href: "/ai-data/solutions#documents-and-reconciliation",
  },
  {
    id: "enquiries",
    title: "Enquiry capture and follow-up",
    input: "Enquiries from email, web forms and phone messages.",
    assist:
      "Records each one, sorts it by what it needs, notes what is missing and drafts a reply.",
    review: "Your team edits and sends every reply. Drafts never go out on their own.",
    outcome: "Every enquiry visible, owned and followed up.",
    href: "/ai-data/solutions#enquiry-capture",
  },
  {
    id: "reporting",
    title: "Reporting from scattered data",
    input: "Spreadsheets and systems that each hold part of the picture.",
    assist: "Collects them on a schedule and applies the definitions you agreed.",
    review: "You review what the report flags: a late source, a figure that looks wrong.",
    outcome: "One report that shows where each number came from.",
    href: "/ai-data/solutions#reporting",
  },
];
