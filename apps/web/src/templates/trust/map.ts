import { routes, trustTopicLabels, trustTopics } from "@vitalos/cms";
import type { PatternLink, SubprocessorRow, TrustTopicRowProps } from "@vitalos/ui";
import type { TrustTopic, TrustTopicSummary, TrustTopicView } from "@vitalos/cms";

/** Trust Centre view models to pattern props. Pure and framework-free. */

/**
 * Structural labels (Stage 9 §27 "Trust Centre template"). The evidence-request action label is
 * the one named in the Stage 1 brief for the controlled procurement flow; it is flagged for owner
 * confirmation alongside the other locked copy.
 */
export const trustLabels = {
  certifications: trustTopicLabels.certifications,
  subprocessors: trustTopicLabels.subprocessors,
  contact: "Contact",
  updated: "Updated",
  requestEvidence: "Request procurement evidence",
} as const;

export const isTrustTopic = (value: string): value is TrustTopic =>
  (trustTopics as readonly string[]).includes(value);

export const trustTopicLabel = (topic: TrustTopic): string => trustTopicLabels[topic];

/** Topic row for the overview. Only real fields: no status is invented. */
export function topicRowProps(topic: TrustTopicSummary): Omit<TrustTopicRowProps, "headingLevel"> {
  return {
    title: topic.title,
    href: routes.trustTopic(topic.topic),
    ...(topic.summary ? { summary: topic.summary } : {}),
    eyebrow: trustTopicLabel(topic.topic),
  };
}

/** The controlled evidence request: the contact form with the procurement intent. Never the evidence itself. */
export const evidenceRequestLink: PatternLink = {
  label: trustLabels.requestEvidence,
  href: routes.contact("procurement"),
};

/** Where the evidence-request call to action appears: the overview and the topics about procurement evidence. */
export const evidenceTopics: readonly TrustTopic[] = ["procurement", "certifications"];

/**
 * Certifications with a name, a scope and an issue date, which is what a verified certification
 * must carry. Anything else is omitted; an empty result means the whole block is omitted.
 */
export function publishableCertifications(topic: TrustTopicView): TrustTopicView["certifications"] {
  return topic.certifications.filter(
    (cert) => cert.name.trim() !== "" && cert.scope.trim() !== "" && cert.issuedAt.trim() !== "",
  );
}

export function subprocessorRows(topic: TrustTopicView): SubprocessorRow[] {
  return topic.subprocessors.map((row) => ({
    name: row.name,
    purpose: row.purpose,
    ...(row.location ? { location: row.location } : {}),
  }));
}

/** A plain address only: no whitespace, one "@", no quotes or angle brackets. */
export function safeEmail(value: string | undefined): string | undefined {
  const email = value?.trim();
  return email && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) ? email : undefined;
}
