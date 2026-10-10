/**
 * Publish readiness: the pure decision behind the guarded Publish action.
 *
 * A document may be published only when it is editorially approved, its governance is complete and
 * current, it passes validation (no error-level markers) and it is not controlled content. The
 * controlled check exists because published documents are readable through the dataset API: controlled
 * evidence stays out of the public CMS (Stage 0 §0 constraints; Stage 6 §14).
 */
import { governanceIssues } from "../schemaTypes/rules/objects";
import { hasText, isRecord, obj, str, todayIso } from "../schemaTypes/rules/issue";

export interface ValidationMarkerLike {
  level: "error" | "warning" | "info";
  message?: string;
}

export interface PublishInput {
  document: unknown;
  markers: readonly ValidationMarkerLike[];
  isValidating?: boolean;
  today?: string;
}

export interface PublishDecision {
  allowed: boolean;
  /** Human-readable reasons, shown as the button tooltip. Empty when allowed. */
  reasons: string[];
}

const statusLabel = (status: string | undefined): string => status ?? "not set";

export function evaluatePublishReadiness(input: PublishInput): PublishDecision {
  const reasons: string[] = [];
  const { document, markers, isValidating = false, today = todayIso() } = input;
  if (!isRecord(document)) return { allowed: false, reasons: ["There is no draft to publish."] };

  const governance = obj(document, "governance");
  const status = str(governance, "editorialStatus");
  if (status !== "approved") {
    reasons.push(
      `Editorial status must be Approved before publishing (currently ${statusLabel(status)}).`,
    );
  }
  if (!hasText(str(governance, "owner"))) reasons.push("Governance needs a content owner.");
  if (!hasText(str(governance, "reviewDate"))) {
    reasons.push("Governance needs a review date.");
  } else {
    for (const found of governanceIssues(governance, today)) reasons.push(found.message);
  }

  if (obj(document, "evidence")?.["classification"] === "controlled") {
    reasons.push(
      "Controlled content must not be published to the CMS. Keep it as a draft or move it to the controlled evidence room.",
    );
  }

  const errorCount = markers.filter((marker) => marker.level === "error").length;
  if (errorCount > 0) {
    reasons.push(`Fix ${errorCount} validation error${errorCount === 1 ? "" : "s"} first.`);
  }
  if (isValidating) reasons.push("Validation is still running.");

  return { allowed: reasons.length === 0, reasons };
}
