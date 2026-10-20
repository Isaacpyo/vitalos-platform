import { randomInt } from "node:crypto";
import type { ConversationRecord, RelayStore } from "../db/types";
import { RelayError } from "./context";

/** A case ID is 15 digits: the Unix time in seconds, then five random digits (migration 20261020). */
export const CASE_ID_PATTERN = /^[0-9]{15}$/;

export function newCaseId(now: Date): string {
  const seconds = Math.floor(now.getTime() / 1000);
  return `${seconds}${String(randomInt(0, 100_000)).padStart(5, "0")}`;
}

const MAX_ATTEMPTS = 5;

/**
 * The conversation's case ID, created on first use. Created once and never changed: the store only
 * sets it while empty, so two requests at the same moment end up with the same ID. A collision with
 * another conversation (about 1 in 100,000 within one second) draws a new one.
 */
export async function ensureCaseId(
  store: Pick<RelayStore, "assignCaseId">,
  now: () => Date,
  conversation: Pick<ConversationRecord, "id" | "caseId">,
): Promise<string> {
  if (conversation.caseId) return conversation.caseId;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const assignment = await store.assignCaseId(conversation.id, newCaseId(now()));
    if (assignment.result === "missing") throw new RelayError("not_found");
    if (assignment.result !== "collision") return assignment.caseId;
  }
  throw new RelayError("unavailable");
}
