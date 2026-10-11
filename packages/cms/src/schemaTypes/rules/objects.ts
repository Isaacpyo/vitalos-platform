/**
 * Rules for reusable objects: governance, evidence, CTA, approved image, rich-text blocks,
 * stats, metrics and testimonials. Pure functions returning `Issue[]`.
 */
import { genericCtaLabels } from "../constants";
import {
  asArray,
  hasText,
  isIsoDate,
  isRecord,
  issue,
  obj,
  str,
  todayIso,
  type Issue,
} from "./issue";

/* ---------- governance (Stage 8 §21 Editorial governance; Stage 10 §9) ---------- */

/** An approved item whose review date has passed must be moved to needs-review or re-reviewed. */
export function governanceIssues(value: unknown, today: string = todayIso()): Issue[] {
  const issues: Issue[] = [];
  if (!isRecord(value)) return issues;
  const status = str(value, "editorialStatus");
  const reviewDate = str(value, "reviewDate");
  if (reviewDate !== undefined && !isIsoDate(reviewDate)) {
    issues.push(issue("Review date must be a valid date (YYYY-MM-DD).", "reviewDate"));
  } else if (status === "approved" && reviewDate !== undefined && reviewDate < today) {
    issues.push(
      issue(
        "Review date has passed. Re-review the content and set a future review date, or set the status to Needs review.",
        "reviewDate",
      ),
    );
  }
  return issues;
}

/* ---------- evidence (Stage 6 §14, §19; Stage 10 §17, §20) ---------- */

/** Heuristic: a pointer that is a web link rather than an internal register reference. */
const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i;

export function evidenceIssues(value: unknown, today: string = todayIso()): Issue[] {
  const issues: Issue[] = [];
  if (!isRecord(value)) return issues;
  const status = str(value, "evidenceStatus");
  const reference = str(value, "evidenceReference");
  const verifiedAt = str(value, "verifiedAt");

  if (reference !== undefined) {
    if (reference.length > 200 || /[\r\n]/.test(reference)) {
      issues.push(
        issue(
          "The evidence reference is a short internal pointer (a register or data-room ID), not the evidence itself.",
          "evidenceReference",
        ),
      );
    }
  }
  if (status === "verified") {
    if (!hasText(str(value, "evidenceOwner"))) {
      issues.push(issue("Verified evidence needs an evidence owner.", "evidenceOwner"));
    }
    if (!hasText(reference)) {
      issues.push(
        issue(
          "Verified evidence needs an internal reference to where the evidence is held.",
          "evidenceReference",
        ),
      );
    }
    if (!hasText(verifiedAt)) {
      issues.push(issue("Verified evidence needs a verification date.", "verifiedAt"));
    }
  }
  if (verifiedAt !== undefined) {
    if (!isIsoDate(verifiedAt)) {
      issues.push(issue("Verification date must be a valid date (YYYY-MM-DD).", "verifiedAt"));
    } else if (verifiedAt > today) {
      issues.push(issue("Verification date cannot be in the future.", "verifiedAt"));
    }
  }
  return issues;
}

export function evidenceWarnings(value: unknown): Issue[] {
  const reference = str(value, "evidenceReference");
  if (reference !== undefined && looksLikeUrl.test(reference.trim())) {
    return [
      issue(
        "This looks like a web link. Use an internal pointer (for example a Trust Register ID); never link the evidence from a public CMS.",
        "evidenceReference",
      ),
    ];
  }
  return [];
}

/** True when the object is verified evidence ("verified" status). */
export const isVerified = (evidence: unknown): boolean =>
  isRecord(evidence) && evidence["evidenceStatus"] === "verified";

/* ---------- cta (Stage 9 §15; Stage 10 §9) ---------- */

export function ctaIssues(value: unknown): Issue[] {
  if (!isRecord(value)) return [];
  const targets = [
    isRecord(value["internalRef"]) && hasText(value["internalRef"]["_ref"]),
    hasText(value["routeKey"]),
  ].filter(Boolean).length;
  if (targets === 0) {
    return [issue("Choose where this call to action goes: a document or a page.", "routeKey")];
  }
  if (targets > 1) {
    return [issue("Choose either a document or a page, not both.", "routeKey")];
  }
  return [];
}

export function ctaWarnings(value: unknown): Issue[] {
  const label = str(value, "label");
  if (
    label !== undefined &&
    (genericCtaLabels as readonly string[]).includes(label.trim().toLowerCase())
  ) {
    return [
      issue(
        `"${label.trim()}" says nothing about the destination. Describe the action or outcome instead.`,
        "label",
      ),
    ];
  }
  return [];
}

/* ---------- approved image (Stage 9 §10; Stage 8 §22) ---------- */

export function approvedImageIssues(value: unknown): Issue[] {
  if (!isRecord(value)) return [];
  const issues: Issue[] = [];
  if (value["decorative"] !== true && !hasText(value["alt"])) {
    issues.push(issue("Add alt text, or mark the image as decorative.", "alt"));
  }
  return issues;
}

/* ---------- rich-text blocks (Stage 10 §9; Stage 9 §9, §30) ---------- */

export function pullQuoteIssues(value: unknown): Issue[] {
  if (!isRecord(value)) return [];
  return hasText(value["attribution"])
    ? []
    : [
        issue(
          "A pull quote needs an attribution; anonymous quotes are not published.",
          "attribution",
        ),
      ];
}

export function figureIssues(value: unknown): Issue[] {
  if (!isRecord(value)) return [];
  const issues: Issue[] = [];
  if (value["kind"] === "diagram" && !hasText(value["textAlternative"])) {
    issues.push(
      issue(
        "Diagrams need a text alternative that conveys the information in the diagram.",
        "textAlternative",
      ),
    );
  }
  return issues;
}

/** Every row must have exactly one cell per column. */
export function dataTableIssues(value: unknown): Issue[] {
  if (!isRecord(value)) return [];
  const columns = asArray(value["columns"]);
  const issues: Issue[] = [];
  asArray(value["rows"]).forEach((row, index) => {
    const cells = isRecord(row) ? asArray(row["cells"]) : [];
    if (cells.length !== columns.length) {
      issues.push(
        issue(
          `Row ${index + 1} has ${cells.length} cell(s) but the table has ${columns.length} column(s).`,
          "rows",
          index,
        ),
      );
    }
  });
  return issues;
}

/* ---------- stat / outcome metric (Stage 8 §14; Stage 10 §17) ---------- */

export function statIssues(value: unknown): Issue[] {
  if (!isRecord(value)) return [];
  const issues: Issue[] = [];
  for (const key of ["value", "descriptor", "source"] as const) {
    if (!hasText(value[key])) {
      issues.push(
        issue(
          `A statistic needs ${key === "source" ? "a source" : `a ${key}`}; unsourced numbers are not published.`,
          key,
        ),
      );
    }
  }
  return issues;
}

export function outcomeMetricIssues(value: unknown): Issue[] {
  const issues = statIssues(value);
  if (isRecord(value) && !hasText(value["context"])) {
    issues.push(
      issue(
        "An outcome metric needs context (what was measured and against what baseline).",
        "context",
      ),
    );
  }
  return issues;
}

/* ---------- testimonial (Stage 6 §18; Stage 10 §17) ---------- */

export function testimonialIssues(value: unknown): Issue[] {
  if (!isRecord(value)) return [];
  const issues: Issue[] = [];
  if (!hasText(value["attribution"])) {
    issues.push(issue("A testimonial needs an attribution.", "attribution"));
  }
  if (value["permissionStatus"] === "granted" && !isVerified(obj(value, "permissionEvidence"))) {
    issues.push(
      issue(
        "Permission is recorded as granted but there is no verified permission evidence.",
        "permissionEvidence",
      ),
    );
  }
  return issues;
}
