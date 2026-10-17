import { describe, expect, it } from "vitest";
import { loadTurnCases, runTurnsEval } from "./turns";

/**
 * CI gate for the Relay turn budget (ADR-048): the fixed 25-question set, memory store, bundled
 * knowledge, mock model. Every question must retrieve an expected source (or, for a question
 * nothing published answers, offer a person), and no model call may exceed 8,000 input tokens.
 */
describe("Relay turn eval (docs/relay/evals/turns.jsonl)", () => {
  it("has 25 questions including the five gap questions", () => {
    const cases = loadTurnCases();
    expect(cases).toHaveLength(25);
    expect(cases.filter((c) => c.id.startsWith("gap-"))).toHaveLength(5);
  });

  it("passes today, with entries awaiting confirmation still drafts", async () => {
    const run = await runTurnsEval();
    const failed = run.results.filter((r) => !r.pass).map((r) => `${r.id}: ${r.reason}`);
    expect(failed).toEqual([]);
    expect(run.maxTokens).toBeLessThanOrEqual(8_000);
    expect(run.results.find((r) => r.id === "gap-hello")?.modelCalls).toBe(0);
  }, 60_000);

  it("passes once the owner approves the drafted entries", async () => {
    const run = await runTurnsEval({ approvePending: true });
    const failed = run.results.filter((r) => !r.pass).map((r) => `${r.id}: ${r.reason}`);
    expect(failed).toEqual([]);
    expect(run.results.find((r) => r.id === "gap-founder")?.retrieved).toContain("founder");
    expect(run.maxTokens).toBeLessThanOrEqual(8_000);
  }, 60_000);
});
