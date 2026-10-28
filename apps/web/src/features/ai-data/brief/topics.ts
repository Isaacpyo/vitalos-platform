import type { TopicSlug } from "./types";

export interface TopicInfo {
  slug: TopicSlug;
  label: string;
  /** Short, editable starter that prefills the description. Written in the visitor's voice. */
  starter: string;
}

export const topics: Record<TopicSlug, TopicInfo> = {
  "finance-reconciliation": {
    slug: "finance-reconciliation",
    label: "Finance and reconciliation",
    starter:
      "We reconcile supplier statements and bank lines by hand. The work is slow and mismatches are easy to miss. ",
  },
  "document-intake": {
    slug: "document-intake",
    label: "Document intake",
    starter:
      "Documents arrive by email and on paper, and someone re-types the details into our system. ",
  },
  "customer-requests": {
    slug: "customer-requests",
    label: "Customer requests",
    starter:
      "Customer requests arrive in a shared inbox and someone has to read, sort and route each one. ",
  },
  "operational-reporting": {
    slug: "operational-reporting",
    label: "Operational reporting",
    starter:
      "Every week we pull numbers from several places into a spreadsheet to build the same report. ",
  },
};

/** Example prompts shown as chips on the first step. Each fills the input; nothing is sent. */
export const exampleChips: readonly { label: string; text: string }[] = [
  { label: "Reconciling statements", text: topics["finance-reconciliation"].starter },
  { label: "Re-typing documents", text: topics["document-intake"].starter },
  { label: "Sorting customer emails", text: topics["customer-requests"].starter },
  { label: "Weekly report by hand", text: topics["operational-reporting"].starter },
];
