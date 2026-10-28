"use server";

import { getEnv } from "@vitalos/config";
import { clientIpFromHeaders } from "@vitalos/security/rate-limit";
import { headers } from "next/headers";
import { MemoryRateLimiter } from "../../content/http/guards";
import { draftBrief, suggestQuestions } from "./assist-service";
import type { AssistActionInput, AssistOutcome, AssistServiceDeps } from "./assist-service";
import { getBriefAssistClient } from "./server";
import type { BriefDraft, BriefQuestion } from "./types";

/**
 * Server actions for the guided brief (W6). The browser never sees the endpoint, the key or the
 * visitor reference: it passes the visitor's text and the opt-in flag, and gets back either AI
 * output or an honest "unavailable" reason. Text is only sent after the opt-in (enforced in the
 * service). Only async functions are exported from this file ("use server").
 */

const limiter = new MemoryRateLimiter();

async function deps(): Promise<AssistServiceDeps> {
  const requestHeaders = await headers();
  return {
    client: getBriefAssistClient(),
    limiter,
    salt: getEnv().enquiry.ipHashSalt,
    ip: clientIpFromHeaders(requestHeaders),
  };
}

export async function requestBriefQuestionsAction(
  raw: Omit<AssistActionInput, "stage">,
): Promise<AssistOutcome<BriefQuestion[]>> {
  try {
    return await suggestQuestions({ ...raw, stage: "questions" }, await deps());
  } catch {
    return { source: "unavailable", reason: "unavailable" };
  }
}

export async function requestBriefDraftAction(
  raw: Omit<AssistActionInput, "stage">,
): Promise<AssistOutcome<BriefDraft>> {
  try {
    return await draftBrief({ ...raw, stage: "brief" }, await deps());
  } catch {
    return { source: "unavailable", reason: "unavailable" };
  }
}
