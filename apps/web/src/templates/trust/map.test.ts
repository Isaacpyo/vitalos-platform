import { describe, expect, it } from "vitest";
import { trustTopics } from "@vitalos/cms";
import type { TrustTopicView } from "@vitalos/cms";
import { fullFixtureSet } from "@vitalos/cms/fixtures";
import {
  evidenceRequestLink,
  evidenceTopics,
  isTrustTopic,
  publishableCertifications,
  safeEmail,
  subprocessorRows,
  topicRowProps,
} from "./map";

const items = fullFixtureSet.documents.trustItem as TrustTopicView[];
const byTopic = (topic: string) => items.find((item) => item.topic === topic)!;

describe("trust mapping", () => {
  it("accepts exactly the known topics", () => {
    for (const topic of trustTopics) expect(isTrustTopic(topic)).toBe(true);
    expect(isTrustTopic("made-up")).toBe(false);
  });

  it("sends the evidence request to the procurement contact intent, never to evidence", () => {
    expect(evidenceRequestLink.href).toBe("/contact?intent=procurement");
    expect(evidenceTopics).toEqual(["procurement", "certifications"]);
  });

  it("omits the certification block when there are no certifications", () => {
    expect(publishableCertifications(byTopic("security"))).toEqual([]);
    expect(publishableCertifications(byTopic("certifications"))).toHaveLength(1);
  });

  it("drops a certification without a scope or issue date", () => {
    const base = byTopic("certifications");
    const cert = base.certifications[0]!;
    expect(
      publishableCertifications({ ...base, certifications: [{ ...cert, scope: " " }] }),
    ).toEqual([]);
    expect(
      publishableCertifications({ ...base, certifications: [{ ...cert, issuedAt: "" }] }),
    ).toEqual([]);
  });

  it("maps subprocessors to table rows and omits an absent location", () => {
    expect(subprocessorRows(byTopic("subprocessors"))).toHaveLength(1);
    const rows = subprocessorRows({
      ...byTopic("subprocessors"),
      subprocessors: [{ name: "A", purpose: "B" }],
    });
    expect(rows).toEqual([{ name: "A", purpose: "B" }]);
    expect(subprocessorRows(byTopic("security"))).toEqual([]);
  });

  it("builds a topic row linking to the topic page", () => {
    const row = topicRowProps({
      id: "x",
      topic: "responsible-ai",
      title: "Responsible AI statement",
    });
    expect(row.href).toBe("/trust/responsible-ai");
    expect(row.eyebrow).toBe("Responsible AI");
  });

  it("accepts a plain address only", () => {
    expect(safeEmail("security@example.invalid")).toBe("security@example.invalid");
    expect(safeEmail("a b@example.invalid")).toBeUndefined();
    expect(safeEmail('x"@example.invalid')).toBeUndefined();
    expect(safeEmail(undefined)).toBeUndefined();
  });
});
