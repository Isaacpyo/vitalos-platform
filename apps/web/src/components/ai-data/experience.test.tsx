import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { demoStatusLabels, finalState } from "../../features/ai-data/demo-labels";
import type { DemoSample } from "../../features/ai-data/demo-labels";
import { demoSamples } from "../../features/ai-data/demonstrator-samples";
import {
  explorerTopics,
  heroStages,
  heroTasks,
  isWorkflowTopic,
  useCaseFlows,
  workflowTopicSlugs,
} from "../../features/ai-data/workflows";
import { DeliveryStages } from "./DeliveryStages";
import { HeroWorkflow } from "./HeroWorkflow";
import { OfferShowcase, UseCases, WorkflowExplorer } from "./home-sections";
import { ReconWorkbench } from "./ReconWorkbench";

/** Parses "12.50" style amounts out of CSV or printed text into pence for cross-checks. */
const toPence = (text: string) => Math.round(Number(text.replace(/,/g, "")) * 100);

describe("demonstrator samples", () => {
  it("offers three samples, all labelled as fictional or synthetic", () => {
    expect(demoSamples.map((s) => s.id)).toEqual([
      "month-end",
      "missing-mismatch",
      "clean-printed",
    ]);
    for (const sample of demoSamples) {
      expect(sample.supplier.toLowerCase()).toContain("fictional");
      expect(sample.origin).toMatch(/synthetic/i);
    }
  });

  it("takes the two extra samples from evaluation dataset v1 and says which cases", () => {
    const byId = (id: string) => demoSamples.find((s) => s.id === id) as DemoSample;
    expect(byId("missing-mismatch").origin).toContain("d03");
    expect(byId("clean-printed").origin).toContain("d02");
  });

  it.each(demoSamples.map((s) => [s.id, s] as const))(
    "%s: every result cites a real source line and carries a known status",
    (_id, sample) => {
      const lines = new Set(sample.raw.map((l) => l.n));
      for (const row of sample.rows) {
        if (row.line !== null) expect(lines.has(row.line), `${row.id} line ${row.line}`).toBe(true);
        expect(demoStatusLabels[row.status]).toBeTruthy();
        // A matched row is never routed to a reviewer, and every other status always is.
        expect(row.review).toBe(row.status !== "matched");
      }
      expect(lines.has(sample.closing.line)).toBe(true);
    },
  );

  it("the dataset v1 samples agree with their source text and expected results", () => {
    const d03 = demoSamples.find((s) => s.id === "missing-mismatch") as DemoSample;
    const row = (id: string) => d03.rows.find((r) => r.id === id);
    expect(row("l6")?.status).toBe("amount-mismatch");
    expect(row("l7")?.status).toBe("missing");
    expect(row("ledger-inv-3199")?.status).toBe("not-on-statement");
    // The statement amounts shown are the ones in the raw text.
    for (const r of d03.rows.filter((x) => x.line !== null && x.statementAmount !== null)) {
      const text = d03.raw.find((l) => l.n === r.line)?.text ?? "";
      expect(toPence(text.split(",")[3] ?? "0"), r.id).toBe(r.statementAmount);
    }
    expect(finalState(d03)).toBe("REVIEW_REQUIRED");
    const d02 = demoSamples.find((s) => s.id === "clean-printed") as DemoSample;
    expect(d02.rows.every((r) => r.status === "matched")).toBe(true);
    expect(finalState(d02)).toBe("COMPLETED");
  });

  it("recomputes each closing balance from the statement text", () => {
    const d03 = demoSamples.find((s) => s.id === "missing-mismatch") as DemoSample;
    // Opening 2000.00 + 820.00 + 1440.00 + 96.50 - 2000.00 + 512.30 = 2868.80
    expect(200000 + 82000 + 144000 + 9650 - 200000 + 51230).toBe(d03.closing.stated);
    const d02 = demoSamples.find((s) => s.id === "clean-printed") as DemoSample;
    // 640.00 + 2340.00 + 118.75 - 1500.00 + 1062.10 - 18.75 = 2642.10
    expect(64000 + 234000 + 11875 - 150000 + 106210 - 1875).toBe(d02.closing.stated);
    for (const sample of demoSamples) expect(sample.closing.recomputed).toBe(sample.closing.stated);
  });
});

describe("workflow content", () => {
  it("uses exactly the four shared topic slugs", () => {
    expect([...workflowTopicSlugs]).toEqual([
      "finance-reconciliation",
      "document-intake",
      "customer-requests",
      "operational-reporting",
    ]);
    expect(explorerTopics.map((t) => t.slug)).toEqual([...workflowTopicSlugs]);
    expect(isWorkflowTopic("finance-reconciliation")).toBe(true);
    expect(isWorkflowTopic("<script>")).toBe(false);
  });

  it("hero tasks are synthetic, cite real lines and end with something a person decides", () => {
    for (const task of heroTasks) {
      const ids = new Set(task.lines.map((l) => l.id));
      for (const field of task.fields)
        for (const id of field.lineIds) expect(ids.has(id)).toBe(true);
      for (const check of task.checks)
        for (const id of check.lineIds) expect(ids.has(id)).toBe(true);
      expect(task.decisions.length).toBeGreaterThan(0);
      expect(task.lines.map((l) => l.text).join(" ")).toMatch(/fictional|example|synthetic/i);
      expect(isWorkflowTopic(task.topic)).toBe(true);
    }
    expect(heroStages.map((s) => s.id)).toEqual(["input", "extract", "check", "review"]);
  });
});

describe("home page server HTML", () => {
  it("hero: labelled as a scripted example on synthetic data, with the input shown first", () => {
    const html = renderToStaticMarkup(<HeroWorkflow />);
    expect(html).toContain("Synthetic data");
    expect(html).toContain("Scripted example, not live AI");
    expect(html).toContain("Step 1 of 4: Input");
    expect(html).toContain("Bramblewood Catering Supplies (fictional)");
    // Without JavaScript the whole walkthrough is in the HTML and the controls are swapped out.
    expect(html).toContain("noscript:flex");
    expect(html).toContain("noscript:hidden");
    expect(html).toContain("Still needs a person");
    // No dialog code is in the first render: the expanded view loads on demand.
    expect(html).not.toContain('role="dialog"');
  });

  it("explorer: all four topics and panels are in the HTML, each linking to its topic brief", () => {
    const html = renderToStaticMarkup(<WorkflowExplorer />);
    for (const slug of workflowTopicSlugs) {
      expect(html).toContain(`id="topic-${slug}"`);
      expect(html).toContain(`data-panel="${slug}"`);
      expect(html).toContain(`/ai-data/contact?topic=${slug}`);
    }
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain('type="radio"');
  });

  it("use cases, delivery path and offers carry their content, with no prices", () => {
    const html = renderToStaticMarkup(
      <>
        <UseCases />
        <DeliveryStages />
        <OfferShowcase />
      </>,
    );
    for (const flow of useCaseFlows) expect(html).toContain(flow.title);
    for (const label of ["Input", "AI assistance", "Human review", "Outcome"])
      expect(html).toContain(label);
    for (const stage of ["Discover", "Prove", "Build", "Operate"]) expect(html).toContain(stage);
    expect(html).toContain("productise");
    expect(html).toContain("You receive");
    expect(html).not.toMatch(/£\s?\d/);
  });

  it("workbench: sample, matched and exception counts, cited source and labels are server-rendered", () => {
    const html = renderToStaticMarkup(
      <ReconWorkbench samples={demoSamples} surface="demonstrator" />,
    );
    expect(html).toContain("Choose a synthetic sample");
    expect(html).toContain("Scripted example, not live AI");
    expect(html).toContain("Source: Statement of account");
    expect(html).toContain("(exception)");
    expect(html).toContain("INV-40127");
    expect(html).toContain("REVIEW_REQUIRED");
    expect(html).toContain('aria-expanded="false"');
    // Evidence panels are collapsed and inert until a result is chosen.
    expect(html).toContain("inert");
  });

  it("preview variant omits the source panel", () => {
    const html = renderToStaticMarkup(
      <ReconWorkbench samples={demoSamples.slice(0, 1)} surface="preview" variant="preview" />,
    );
    expect(html).not.toContain("Source: Statement of account");
    expect(html).toContain("INV-40127");
  });
});
