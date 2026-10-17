import { describe, expect, it } from "vitest";
import type { MatchedChunk } from "../db/types";
import { isExplicitHandoffRequest } from "../handoff/intent";
import { finaliseCitations, nextStepFor } from "./citations";
import { HANDOFF_MARKER, MarkerGuard } from "./markers";
import { mockAnswer } from "./mock";
import { buildUserMessage } from "./prompts/context";
import { SYSTEM_PROMPT } from "./prompts/system";
import { estimateCostUsd, isPeak } from "./provider";

const chunk = (n: number, over: Partial<MatchedChunk> = {}): MatchedChunk => ({
  chunkId: `c${n}`,
  documentId: `d${n}`,
  title: `Doc ${n}`,
  url: `/offers/doc-${n}`,
  type: "offer",
  source: "cms",
  externalId: null,
  heading: `Doc ${n}`,
  content: `Content of document ${n}. It explains things clearly and in detail.`,
  meta: {},
  rrfScore: 1 / n,
  similarity: null,
  ftsRank: 0.3,
  ...over,
});

describe("system prompt", () => {
  it("is byte-stable (snapshot) and carries six practices with Labs the sixth, no banned words", () => {
    expect(SYSTEM_PROMPT).toMatchSnapshot();
    expect(SYSTEM_PROMPT).toContain(
      "One firm, six practices: Consulting; Engineering; AI & Data; Experience; Managed Services; Labs (research and technical proof).",
    );
    expect(SYSTEM_PROMPT).toContain("Six solutions:");
    expect(SYSTEM_PROMPT).not.toMatch(/\bfive (practices|solutions)\b/i);
    expect(SYSTEM_PROMPT).toContain("SOURCES marked (FAQ) are approved answers.");
    expect(SYSTEM_PROMPT).not.toMatch(/deepseek-chat|deepseek-reasoner/);
  });
});

describe("MarkerGuard", () => {
  it("never releases the marker, even split across chunks", () => {
    const g = new MarkerGuard();
    const chunks = ["A person from the team can help with this.\n[[ha", "nd", "off]]"];
    const released = chunks.map((c) => g.push(c)).join("");
    const { rest, text, handoff } = g.finish();
    expect(handoff).toBe(true);
    expect(released + rest).toBe("A person from the team can help with this.");
    expect(text).toBe("A person from the team can help with this.");
    expect(released).not.toContain("[[");
  });

  it("releases ordinary text progressively and completely", () => {
    const g = new MarkerGuard();
    const out = [
      "Yes. Application Modernisation",
      " is one of our core offers [1].",
      " We start by assessing the system.",
    ]
      .map((c) => g.push(c))
      .join("");
    const { rest, handoff } = g.finish();
    expect(handoff).toBe(false);
    expect(out + rest).toBe(
      "Yes. Application Modernisation is one of our core offers [1]. We start by assessing the system.",
    );
    expect(out.length).toBeGreaterThan(0);
  });

  it("strips a partial marker at the end of a stopped answer", () => {
    const g = new MarkerGuard();
    g.push("Done. [[hand");
    expect(g.partial()).toBe("Done.");
    expect(HANDOFF_MARKER).toBe("[[handoff]]");
  });
});

describe("finaliseCitations", () => {
  const sources = [chunk(1), chunk(2), chunk(3), chunk(4, { documentId: "d1", chunkId: "c4" })];

  it("drops invalid numbers, de-duplicates by document, keeps at most three and renumbers", () => {
    const { text, citations } = finaliseCitations(
      "One [1]. Two [9]. Three [4]. Four [3][2]. Five [2].",
      sources,
    );
    expect(citations.map((c) => c.documentId)).toEqual(["d1", "d3", "d2"]);
    expect(citations.map((c) => c.n)).toEqual([1, 2, 3]);
    expect(text).toBe("One [1]. Two. Three [1]. Four [2][3]. Five [3].");
  });

  it("maps FAQ sources to canonical paths and the FAQ tag", () => {
    const faq = chunk(1, {
      source: "faq",
      type: "faq",
      url: null,
      meta: {
        canonical_path: "/trust/security",
        next_step: { kind: "link", label: "Explore Labs", href: "/labs" },
      },
    });
    const { citations } = finaliseCitations("No [1].", [faq]);
    expect(citations[0]).toMatchObject({ url: "/trust/security", type: "FAQ" });
    expect(nextStepFor(citations, [faq])).toEqual({
      kind: "link",
      label: "Explore Labs",
      href: "/labs",
    });
    expect(nextStepFor(finaliseCitations("Yes [1].", [chunk(1)]).citations, [chunk(1)])).toBeNull();
  });
});

describe("explicit hand-off intent", () => {
  it.each([
    "Can I talk to a person?",
    "I'd like to speak to someone real",
    "human",
    "Please call me back",
    "Can someone phone me tomorrow?",
    "put me in touch with a consultant",
    "talk to your team",
    "Is there a real person I can speak with",
  ])("matches %j", (text) => expect(isExplicitHandoffRequest(text)).toBe(true));

  it.each([
    "Do you build phone apps?",
    "How many people are in the team?",
    "We're a care provider with a scheduling system",
    "What does a Technology Health Assessment involve?",
    "can your AI do this on its own",
  ])("does not match %j", (text) => expect(isExplicitHandoffRequest(text)).toBe(false));
});

describe("mock provider and context", () => {
  const message = buildUserMessage({
    pagePath: "/offers/application-modernisation",
    pageTitle: "Application Modernisation",
    teamOnline: true,
    now: new Date("2026-10-15T13:21:00Z"),
    confident: true,
    sources: [chunk(1), chunk(2)],
    question: "Could you modernise our system?",
  });

  it("builds the context block in the documented order with numbered sources", () => {
    expect(message).toMatch(
      /^CONTEXT\nPage: \/offers\/application-modernisation \(Application Modernisation\)\nTeam: online\nToday: Thursday 15 October 2026, 14:21 Europe\/London\nRetrieval: confident\n\nSOURCES\n\[1\] Doc 1 \(offer\) \/offers\/doc-1\n/,
    );
    expect(message.endsWith("\n\nQUESTION\nCould you modernise our system?")).toBe(true);
  });

  it("answers from sources with citations, and hands off on price questions and low confidence", () => {
    expect(mockAnswer(message)).toMatch(/^Content of document 1\.[^\n]*\[1\]/);
    const price = buildUserMessage({
      pagePath: "/",
      pageTitle: null,
      teamOnline: false,
      now: new Date(),
      confident: true,
      sources: [chunk(1)],
      question: "How much does it cost?",
    });
    expect(mockAnswer(price)).toContain("[[handoff]]");
    const low = buildUserMessage({
      pagePath: "/",
      pageTitle: null,
      teamOnline: false,
      now: new Date(),
      confident: false,
      sources: [chunk(1)],
      question: "Capital of France?",
    });
    expect(low).toContain("SOURCES\n(none)");
    expect(mockAnswer(low)).toMatch(/won't guess[\s\S]*\[\[handoff\]\]/);
  });
});

describe("pricing", () => {
  it("uses peak prices only on weekday UTC peak hours", () => {
    expect(isPeak(new Date("2026-10-14T02:00:00Z"))).toBe(true);
    expect(isPeak(new Date("2026-10-14T12:00:00Z"))).toBe(false);
    expect(isPeak(new Date("2026-10-17T02:00:00Z"))).toBe(false);
    const usage = { inputTokens: 2500, outputTokens: 250, cacheHitTokens: 2000 };
    expect(estimateCostUsd(usage, "deepseek-flash", new Date("2026-10-14T12:00:00Z"))).toBeCloseTo(
      (2000 * 0.003 + 500 * 0.15 + 250 * 0.6) / 1e6,
      9,
    );
  });
});
