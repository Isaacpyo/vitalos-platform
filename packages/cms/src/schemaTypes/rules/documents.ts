/**
 * Document-level rules (cross-field relationships and evidence rules). Pure functions returning
 * `Issue[]`; wired into the schemas with `errors()` / `warnings()` and unit-tested in isolation.
 */
import { legalSlugs } from "../../routes";
import { isValidSlug } from "../../routes";
import { homeSections } from "../../locked-copy";
import {
  asArray,
  countRefs,
  hasText,
  isHttpsUrl,
  isIsoDate,
  isRecord,
  issue,
  obj,
  str,
  todayIso,
  type Issue,
} from "./issue";
import { evidenceIssues, isVerified } from "./objects";

/* ---------- slugs ---------- */

export function slugIssues(value: unknown): Issue[] {
  if (!isRecord(value) || !hasText(value["current"])) return [];
  return isValidSlug(value["current"])
    ? []
    : [
        issue(
          "Use lower-case letters, numbers and single hyphens only (for example 'ai-opportunity-assessment').",
          "current",
        ),
      ];
}

export function legalSlugIssues(value: unknown): Issue[] {
  if (!isRecord(value) || !hasText(value["current"])) return [];
  return (legalSlugs as readonly string[]).includes(value["current"])
    ? []
    : [issue(`A legal page slug must be one of: ${legalSlugs.join(", ")}.`, "current")];
}

/* ---------- relationships (Stage 10 §15 "Relationship validation") ---------- */

/** No orphan offers: every offer links to at least one solution or practice. */
export function offerIssues(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  if (countRefs(doc["solutions"]) + countRefs(doc["practices"]) === 0) {
    return [
      issue(
        "Orphan offer: link this offer to at least one solution or practice before publishing.",
        "solutions",
      ),
    ];
  }
  return [];
}

/** Every solution lists at least one offer. */
export function solutionIssues(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  if (countRefs(doc["offers"]) === 0) {
    return [issue("A solution needs at least one offer before it can publish.", "offers")];
  }
  return [];
}

/* ---------- case study (Stage 10 §17 "Evidence rule") ---------- */

const figureBlockTypes = new Set(["figure"]);

function containsFigure(blocks: unknown): boolean {
  return asArray(blocks).some(
    (block) => isRecord(block) && figureBlockTypes.has(String(block["_type"])),
  );
}

export function caseStudyIssues(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  const issues: Issue[] = [];
  const display = str(doc, "clientDisplay");

  if (display === "named") {
    if (!hasText(doc["clientName"])) {
      issues.push(issue("A named client needs the client name.", "clientName"));
    }
    if (!isVerified(obj(doc, "permissionEvidence"))) {
      issues.push(
        issue(
          "Named client without verified permission evidence. Record the permission and mark it verified, or anonymise the case study.",
          "permissionEvidence",
        ),
      );
    }
  } else if (display === "anonymised") {
    if (hasText(doc["clientName"])) {
      issues.push(
        issue("An anonymised case study must not carry the client name. Clear it.", "clientName"),
      );
    }
    if (!hasText(doc["anonymisedDescriptor"])) {
      issues.push(
        issue(
          "Describe the anonymised client (for example sector and size) without identifying them.",
          "anonymisedDescriptor",
        ),
      );
    }
  }

  const hasFigures = ["challenge", "approach", "outcome"].some((key) => containsFigure(doc[key]));
  if (hasFigures && doc["disclosureApproved"] !== true) {
    issues.push(
      issue(
        "Screenshots and architecture figures need client disclosure approval. Confirm approval or remove the figures.",
        "disclosureApproved",
      ),
    );
  }
  return issues;
}

/* ---------- insight (Stage 8 §16; Stage 10 §18) ---------- */

export function insightIssues(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  const issues: Issue[] = [];
  if (countRefs(doc["authors"]) === 0) {
    issues.push(issue("An insight needs at least one named author.", "authors"));
  }
  const published = str(doc, "publishedAt");
  const updated = str(doc, "updatedAt");
  if (published !== undefined && updated !== undefined && updated < published) {
    issues.push(issue("The updated date cannot be before the published date.", "updatedAt"));
  }
  return issues;
}

/* ---------- person ---------- */

export function personIssues(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  const issues: Issue[] = [];
  asArray(doc["sameAs"]).forEach((link, index) => {
    if (!isRecord(link)) return;
    if (!isHttpsUrl(link["url"])) {
      issues.push(issue("Profile links must be https URLs.", "sameAs", index, "url"));
    }
  });
  return issues;
}

/* ---------- lab asset (Stage 10 §19 "Labs release rules") ---------- */

export function labAssetIssues(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  const issues: Issue[] = [];
  const maintained = doc["maintained"] === true;
  for (const key of ["repoUrl", "demoUrl"] as const) {
    const value = str(doc, key);
    if (value === undefined || value.length === 0) continue;
    if (!maintained) {
      issues.push(
        issue(
          "Repository and demo links are published only for maintained assets. Clear the link or mark the asset as maintained.",
          key,
        ),
      );
    } else if (!isHttpsUrl(value)) {
      issues.push(issue("Links must be https URLs.", key));
    }
  }
  if (doc["maturity"] === "production-product" && !isVerified(obj(doc, "supportEvidence"))) {
    issues.push(
      issue(
        "A production product needs verified support evidence (a separately supported commercial product must genuinely exist).",
        "supportEvidence",
      ),
    );
  }
  return issues;
}

/* ---------- trust item (Stage 6 §14; Stage 8 §18; Stage 10 §20) ---------- */

export function certificationIssues(
  cert: unknown,
  index: number,
  today: string = todayIso(),
): Issue[] {
  if (!isRecord(cert)) return [];
  const at = (...rest: (string | number)[]) => ["certifications", index, ...rest];
  const issues: Issue[] = [];
  const named = (message: string, ...path: (string | number)[]) => ({
    message,
    path: at(...path),
  });
  if (!hasText(cert["name"])) issues.push(named("A certification needs a name.", "name"));
  if (!hasText(cert["scope"])) {
    issues.push(named("A certification needs its scope (what it covers).", "scope"));
  }
  const issued = str(cert, "issuedAt");
  const expires = str(cert, "expiresAt");
  if (!isIsoDate(issued)) {
    issues.push(named("A certification needs a valid issue date.", "issuedAt"));
  }
  if (!isIsoDate(expires)) {
    issues.push(named("A certification needs a valid expiry date.", "expiresAt"));
  } else if (isIsoDate(issued) && expires <= issued) {
    issues.push(named("The expiry date must be after the issue date.", "expiresAt"));
  } else if (expires < today) {
    issues.push(
      named(
        "This certification has expired. Only current certifications are published.",
        "expiresAt",
      ),
    );
  }
  const evidence = obj(cert, "evidence");
  if (!isVerified(evidence)) {
    issues.push(
      named(
        "Only verified certifications are published. Verify the evidence or remove the entry.",
        "evidence",
      ),
    );
  } else {
    for (const found of evidenceIssues(evidence, today)) {
      issues.push(named(found.message, "evidence", ...(found.path ?? [])));
    }
  }
  return issues;
}

export function trustItemIssues(doc: unknown, today: string = todayIso()): Issue[] {
  if (!isRecord(doc)) return [];
  const issues: Issue[] = [];
  const certifications = asArray(doc["certifications"]);
  const subprocessors = asArray(doc["subprocessors"]);
  const controlled = obj(doc, "evidence")?.["classification"] === "controlled";

  if (controlled && (certifications.length > 0 || subprocessors.length > 0)) {
    issues.push(
      issue(
        "Controlled items are never published. Move certification and subprocessor rows to a public item, or reclassify this one.",
        certifications.length > 0 ? "certifications" : "subprocessors",
      ),
    );
  }
  certifications.forEach((cert, index) => issues.push(...certificationIssues(cert, index, today)));
  subprocessors.forEach((row, index) => {
    if (!isRecord(row)) return;
    if (!hasText(row["name"]) || !hasText(row["purpose"])) {
      issues.push(issue("A subprocessor needs a name and a purpose.", "subprocessors", index));
    }
  });
  return issues;
}

/** Flags (never blocks) controlled trust content so editors cannot mistake it for public content. */
export function trustItemWarnings(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  const flags: Issue[] = [];
  if (obj(doc, "evidence")?.["classification"] === "controlled") {
    flags.push(
      issue(
        "Flagged: this trust item is controlled. It is excluded from the public site; hold the evidence itself in the controlled evidence room, not in this document.",
        "evidence",
        "classification",
      ),
    );
  }
  asArray(doc["certifications"]).forEach((cert, index) => {
    if (obj(cert, "evidence")?.["classification"] === "controlled") {
      flags.push(
        issue(
          "Flagged: this certification is controlled and will not be published.",
          "certifications",
          index,
          "evidence",
        ),
      );
    }
  });
  return flags;
}

/* ---------- job (Stage 8 §19; Stage 10 §12 conditional pages) ---------- */

export function jobIssues(doc: unknown, today: string = todayIso()): Issue[] {
  if (!isRecord(doc)) return [];
  const issues: Issue[] = [];
  const posted = str(doc, "datePosted");
  const through = str(doc, "validThrough");
  if (posted !== undefined && through !== undefined && through < posted) {
    issues.push(issue("'Valid through' cannot be before the posting date.", "validThrough"));
  }
  if (doc["status"] === "open") {
    if (!isHttpsUrl(doc["applicationUrl"])) {
      issues.push(issue("An open role needs an https application link.", "applicationUrl"));
    }
    if (asArray(doc["description"]).length === 0) {
      issues.push(issue("An open role needs a description.", "description"));
    }
    if (through !== undefined && through < today) {
      issues.push(
        issue(
          "This role's 'valid through' date has passed. Close the role or extend the date.",
          "validThrough",
        ),
      );
    }
  }
  return issues;
}

/* ---------- route page ---------- */

export function routePageIssues(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  const issues: Issue[] = [];
  const contact = doc["routeKey"] === "contact";
  if (!contact) {
    for (const key of ["expectations", "successMessage", "routes"] as const) {
      const value = doc[key];
      const present = Array.isArray(value) ? value.length > 0 : hasText(value);
      if (present) {
        issues.push(issue("Only the contact page uses this field. Clear it.", key));
      }
    }
  } else {
    const seen = new Set<string>();
    asArray(doc["routes"]).forEach((route, index) => {
      const intent = str(route, "intent");
      if (intent === undefined) return;
      if (seen.has(intent)) {
        issues.push(issue("Each contact intent can appear once.", "routes", index, "intent"));
      }
      seen.add(intent);
    });
  }
  return issues;
}

/* ---------- home page (Stage 8 §8; Stage 11 §9) ---------- */

const homeSectionKeys: readonly string[] = homeSections.map((section) => section.key);

export function homePageIssues(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  const issues: Issue[] = [];
  const seen = new Set<string>();
  asArray(doc["homeSections"]).forEach((entry, index) => {
    const key = str(entry, "sectionKey");
    if (key === undefined) return;
    if (!homeSectionKeys.includes(key)) {
      issues.push(issue("Unknown homepage section.", "homeSections", index, "sectionKey"));
    } else if (seen.has(key)) {
      issues.push(
        issue("Each homepage section can appear once.", "homeSections", index, "sectionKey"),
      );
    }
    seen.add(key);
  });
  if (countRefs(doc["selectedWork"]) > 4) {
    issues.push(issue("Selected Work shows 2-4 case studies (Stage 8 §8).", "selectedWork"));
  }
  return issues;
}

/* ---------- site settings (Stage 8 §21 Global Settings; Stage 10 §9) ---------- */

/** Companies House number: 8 digits, or a 2-letter prefix and 6 digits (for example SC123456). */
const companyNumberPattern = /^(?:\d{8}|[A-Z]{2}\d{6})$/;

export function siteSettingsIssues(doc: unknown): Issue[] {
  if (!isRecord(doc)) return [];
  const issues: Issue[] = [];
  asArray(doc["social"]).forEach((link, index) => {
    if (!isRecord(link)) return;
    if (!isHttpsUrl(link["href"])) {
      issues.push(issue("Social links must be https URLs.", "social", index, "href"));
    }
  });
  return issues;
}

export function siteSettingsWarnings(doc: unknown): Issue[] {
  const number = str(doc, "companyNumber");
  if (number !== undefined && number.length > 0 && !companyNumberPattern.test(number.trim())) {
    return [
      issue(
        "This does not look like a Companies House number (8 digits, or two letters and 6 digits). Check it against the register.",
        "companyNumber",
      ),
    ];
  }
  return [];
}
