"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "@vitalos/ui";
import { Skeleton } from "@vitalos/ui/interactive";
import { routes } from "@vitalos/cms";
import { heroStages, heroStatement, heroTasks } from "../../features/ai-data/workflows";
import type { HeroStageId, HeroTask } from "../../features/ai-data/workflows";
import { track, trackOnce, currentRoute } from "./track";
import { Expand, MethodChip, ScriptedLabels, SourceLines, cx } from "./work-surface";

/**
 * The hero workflow: choose a sample task, inspect the input, step through the stages and review
 * the structured result and what still needs a person. A SCRIPTED example on SYNTHETIC data: it
 * says so on the surface, the stages move only when the visitor asks (no timers, no typing
 * effect), and nothing here calls a model.
 *
 * Without JavaScript the server HTML shows the whole walkthrough of the first task at once
 * (`noscript:` variants swap the controls for it), so the panel is meaningful before and without
 * hydration. The heavier expanded view (a dialog) loads only when asked for.
 */

const ExpandedDemo = dynamic(() => import("./ExpandedDemo"), {
  ssr: false,
  // Shown only while the dialog code is genuinely being fetched.
  loading: () => (
    <div role="status" aria-busy="true" className="flex flex-col gap-(--space-2)">
      <span className="sr-only">Loading the expanded view</span>
      <Skeleton className="h-6 w-1/2" />
      <Skeleton lines={3} />
    </div>
  ),
});

const lineNumber = (id: string) => Number(id.slice(1));

function LinesFor({
  task,
  marked,
  label,
}: Readonly<{ task: HeroTask; marked: readonly string[]; label: string }>) {
  return (
    <SourceLines
      label={label}
      marked={marked}
      lines={task.lines.map((line) => ({ id: line.id, n: lineNumber(line.id), text: line.text }))}
    />
  );
}

function Evidence({ task, ids }: Readonly<{ task: HeroTask; ids: readonly string[] }>) {
  if (ids.length === 0) {
    return (
      <p className="m-0 px-(--space-3) pb-(--space-3) text-small text-aid-muted">
        No source line: this item exists only in your records, so there is nothing on the input to
        cite.
      </p>
    );
  }
  return (
    <div className="px-(--space-3) pb-(--space-3)">
      <SourceLines
        label="Cited source lines"
        marked={ids}
        lines={task.lines
          .filter((line) => ids.includes(line.id))
          .map((line) => ({ id: line.id, n: lineNumber(line.id), text: line.text }))}
      />
    </div>
  );
}

/** A row that expands to show the source lines it cites. */
function EvidenceRow({
  id,
  open,
  onToggle,
  head,
  task,
  lineIds,
  tone = "neutral",
}: Readonly<{
  id: string;
  open: boolean;
  onToggle: () => void;
  head: ReactNode;
  task: HeroTask;
  lineIds: readonly string[];
  tone?: "neutral" | "pass" | "flag";
}>) {
  return (
    <li
      className={cx(
        "rounded-md border bg-aid-bg transition-[border-color,box-shadow] duration-(--duration-feedback)",
        open ? "border-aid-signal" : "border-aid-border hover:border-aid-line",
        tone === "flag" && !open && "border-aid-line/60",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex min-h-11 w-full items-start gap-(--space-3) rounded-md px-(--space-3) py-(--space-2) text-left"
      >
        <span className="min-w-0 flex-1">{head}</span>
        <Icon
          name="chevron-down"
          size={16}
          className={cx(
            "mt-1 shrink-0 text-aid-muted transition-transform duration-(--duration-disclosure) ease-(--ease-standard)",
            open && "rotate-180",
          )}
        />
      </button>
      <Expand id={id} open={open}>
        <Evidence task={task} ids={lineIds} />
      </Expand>
    </li>
  );
}

function StageBody({
  task,
  stage,
  openId,
  setOpenId,
  baseId,
  onExpanded,
}: Readonly<{
  task: HeroTask;
  stage: HeroStageId;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  baseId: string;
  onExpanded: (itemId: string) => void;
}>) {
  const toggle = (key: string, itemId: string) => {
    const next = openId === key ? null : key;
    setOpenId(next);
    if (next) onExpanded(itemId);
  };
  if (stage === "input") {
    return (
      <div className="flex flex-col gap-(--space-3)">
        <p className="m-0 text-small font-semibold text-aid-heading">{task.inputTitle}</p>
        <LinesFor task={task} marked={[]} label="Input, line by line" />
        <p className="m-0 text-small text-aid-muted">
          Choose Next to see what the software reads from it.
        </p>
      </div>
    );
  }
  if (stage === "extract") {
    return (
      <ul className="m-0 flex list-none flex-col gap-(--space-2) p-0">
        {task.fields.map((field) => (
          <EvidenceRow
            key={field.id}
            id={`${baseId}-f-${field.id}`}
            open={openId === field.id}
            onToggle={() => toggle(field.id, field.lineIds[0] ?? "none")}
            task={task}
            lineIds={field.lineIds}
            head={
              <span className="flex flex-wrap items-center gap-x-(--space-3) gap-y-(--space-1)">
                <span className="text-small text-aid-muted">{field.label}</span>
                <span className="font-semibold text-aid-heading">{field.value}</span>
                <MethodChip method={field.method} />
              </span>
            }
          />
        ))}
      </ul>
    );
  }
  if (stage === "check") {
    return (
      <ul className="m-0 flex list-none flex-col gap-(--space-2) p-0">
        {task.checks.map((check) => (
          <EvidenceRow
            key={check.id}
            id={`${baseId}-c-${check.id}`}
            open={openId === check.id}
            onToggle={() => toggle(check.id, check.lineIds[0] ?? "none")}
            task={task}
            lineIds={check.lineIds}
            tone={check.outcome}
            head={
              <span className="flex items-start gap-(--space-3)">
                <span
                  className={cx(
                    "mt-0.5 inline-flex shrink-0 items-center gap-(--space-1) rounded-sm px-(--space-2) py-0.5 text-[0.75rem] font-semibold",
                    check.outcome === "pass"
                      ? "bg-aid-ok-bg text-aid-ok"
                      : "bg-aid-warn-bg text-aid-warn",
                  )}
                >
                  <Icon
                    name={check.outcome === "pass" ? "check" : "flag"}
                    size={16}
                    className="shrink-0"
                  />
                  {check.outcome === "pass" ? "Passed" : "Flagged"}
                </span>
                <span className="text-aid-heading">{check.text}</span>
              </span>
            }
          />
        ))}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-(--space-4)">
      <dl className="m-0 grid grid-cols-1 gap-(--space-2) min-[480px]:grid-cols-3">
        {task.result.map((item) => (
          <div
            key={item.label}
            className="rounded-md border border-aid-border bg-aid-bg px-(--space-3) py-(--space-2)"
          >
            <dt className="text-small text-aid-muted">{item.label}</dt>
            <dd className="m-0 font-semibold text-aid-heading">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 flex flex-wrap items-center gap-(--space-2) text-small text-aid-muted">
        Final state
        <code className="rounded-sm bg-aid-signal-soft px-(--space-2) py-0.5 font-mono font-semibold text-aid-signal">
          {task.state}
        </code>
      </p>
      <div className="flex flex-col gap-(--space-2) rounded-md border border-aid-signal/60 bg-aid-signal-soft p-(--space-4)">
        <p className="m-0 flex items-center gap-(--space-2) font-semibold text-aid-heading">
          <Icon name="person" size={20} className="shrink-0 text-aid-signal" />
          Still needs a person
        </p>
        <ul className="m-0 flex list-disc flex-col gap-(--space-1) pl-(--space-5) text-aid-text">
          {task.decisions.map((decision) => (
            <li key={decision}>{decision}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** What a visitor without JavaScript gets: the full walkthrough of the first task, at once. */
function StaticWalkthrough({ task }: Readonly<{ task: HeroTask }>) {
  return (
    <div className="hidden flex-col gap-(--space-4) noscript:flex">
      <p className="m-0 text-small text-aid-muted">
        The interactive walkthrough needs JavaScript. Here is the whole example in one view.
      </p>
      {heroStages.map((stage, index) => (
        <section key={stage.id} className="flex flex-col gap-(--space-2)">
          <h3 className="m-0 text-body font-semibold text-aid-heading">
            {index + 1}. {stage.label}
          </h3>
          <p className="m-0 text-small text-aid-muted">{stage.summary}</p>
          {stage.id === "input" ? (
            <LinesFor task={task} marked={[]} label="Input, line by line" />
          ) : stage.id === "extract" ? (
            <ul className="m-0 flex list-disc flex-col gap-(--space-1) pl-(--space-5)">
              {task.fields.map((f) => (
                <li key={f.id}>
                  {f.label}: {f.value} (line {f.lineIds.map(lineNumber).join(", ") || "none"})
                </li>
              ))}
            </ul>
          ) : stage.id === "check" ? (
            <ul className="m-0 flex list-disc flex-col gap-(--space-1) pl-(--space-5)">
              {task.checks.map((c) => (
                <li key={c.id}>
                  {c.outcome === "pass" ? "Passed" : "Flagged"}: {c.text}
                </li>
              ))}
            </ul>
          ) : (
            <StageBody
              task={task}
              stage="review"
              openId={null}
              setOpenId={() => undefined}
              baseId="static"
              onExpanded={() => undefined}
            />
          )}
        </section>
      ))}
    </div>
  );
}

export function HeroWorkflow() {
  const baseId = useId();
  const [taskId, setTaskId] = useState(heroTasks[0]?.id ?? "statement");
  const [stageIndex, setStageIndex] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [announce, setAnnounce] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const task = heroTasks.find((t) => t.id === taskId) ?? heroTasks[0];
  if (!task) return null;
  const stage = heroStages[stageIndex] ?? heroStages[0];
  if (!stage) return null;

  const goTo = (index: number) => {
    const next = heroStages[index];
    if (!next) return;
    setStageIndex(index);
    setOpenId(null);
    setAnnounce(`Step ${index + 1} of ${heroStages.length}: ${next.label}`);
    track("demo_stage_viewed", { surface: "hero", sampleId: task.id, stage: next.id });
  };

  const chooseTask = (next: HeroTask) => {
    if (next.id === taskId) return;
    setTaskId(next.id);
    setStageIndex(0);
    setOpenId(null);
    setAnnounce(`${next.label} chosen. Step 1 of ${heroStages.length}: Input`);
    trackOnce("workflow_started", { source: "hero", topic: next.topic });
    track("demo_sample_chosen", { surface: "hero", sampleId: next.id });
  };

  const isLast = stageIndex === heroStages.length - 1;
  const nextLabel = heroStages[stageIndex + 1]?.label;

  return (
    <div
      id="aid-hero-workflow"
      className="flex min-w-0 flex-col gap-(--space-4) rounded-xl border border-aid-line/40 bg-aid-surface p-(--space-4) shadow-floating sm:p-(--space-5)"
    >
      <div className="flex flex-col gap-(--space-2)">
        <ScriptedLabels compact />
        <p className="m-0 text-small text-aid-muted">{heroStatement}</p>
      </div>

      <div className="flex min-w-0 flex-col gap-(--space-4) noscript:hidden">
        <div
          role="group"
          aria-label="Choose a sample task"
          className="flex flex-wrap gap-(--space-2)"
        >
          {heroTasks.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === taskId}
              onClick={() => chooseTask(t)}
              className={cx(
                "min-h-11 rounded-md border px-(--space-3) text-small font-semibold transition-[border-color,background-color,transform] duration-(--duration-feedback) active:translate-y-px",
                t.id === taskId
                  ? "border-aid-signal bg-aid-signal-soft text-aid-heading"
                  : "border-aid-line/50 text-aid-muted hover:border-aid-line hover:text-aid-heading",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ol aria-label="Stages" className="m-0 grid list-none grid-cols-4 gap-(--space-1) p-0">
          {heroStages.map((s, index) => {
            const state = index === stageIndex ? "current" : index < stageIndex ? "done" : "todo";
            return (
              <li key={s.id} className="min-w-0">
                <button
                  type="button"
                  aria-current={state === "current" ? "step" : undefined}
                  onClick={() => goTo(index)}
                  className={cx(
                    "flex min-h-11 w-full min-w-0 flex-col items-start gap-0.5 border-t-2 px-(--space-1) pt-(--space-2) pb-(--space-1) text-left transition-colors duration-(--duration-feedback)",
                    state === "current"
                      ? "border-aid-signal text-aid-heading"
                      : state === "done"
                        ? "border-aid-signal/50 text-aid-text hover:text-aid-heading"
                        : "border-aid-line/40 text-aid-muted hover:text-aid-heading",
                  )}
                >
                  <span className="flex items-center gap-(--space-1) font-mono text-[0.75rem]">
                    {state === "done" ? <Icon name="check" size={16} /> : index + 1}
                  </span>
                  <span className="truncate text-small font-semibold">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex min-h-[22rem] flex-col gap-(--space-3)">
          <div className="flex flex-col gap-(--space-1)">
            <h3
              ref={headingRef}
              tabIndex={-1}
              className="m-0 text-body font-semibold text-aid-heading outline-none"
            >
              Step {stageIndex + 1} of {heroStages.length}: {stage.label}
            </h3>
            <p className="m-0 flex flex-wrap items-center gap-x-(--space-2) text-small text-aid-muted">
              {stage.summary}
            </p>
          </div>
          <StageBody
            key={`${task.id}-${stage.id}`}
            task={task}
            stage={stage.id}
            openId={openId}
            setOpenId={setOpenId}
            baseId={baseId}
            onExpanded={(itemId) =>
              track("demo_evidence_expanded", {
                surface: "hero",
                sampleId: task.id,
                itemId: itemId === "none" ? "none" : itemId,
              })
            }
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-(--space-3) border-t border-aid-line/30 pt-(--space-3)">
          <button
            type="button"
            disabled={stageIndex === 0}
            onClick={() => goTo(stageIndex - 1)}
            className="inline-flex min-h-11 items-center gap-(--space-2) rounded-md px-(--space-3) text-small font-semibold text-aid-text transition-colors duration-(--duration-feedback) hover:text-aid-heading disabled:cursor-not-allowed disabled:text-aid-muted disabled:opacity-60"
          >
            <Icon name="arrow-left" size={16} />
            Back
          </button>
          <div className="flex flex-wrap items-center gap-(--space-2)">
            <button
              type="button"
              onClick={() => {
                setExpanded(true);
                track("ai_data_cta_click", { ctaId: "open-expanded-demo", route: currentRoute() });
              }}
              className="inline-flex min-h-11 items-center gap-(--space-2) rounded-md border border-aid-line/50 px-(--space-3) text-small font-semibold text-aid-heading transition-[border-color,transform] duration-(--duration-feedback) hover:border-aid-line active:translate-y-px"
            >
              <Icon name="expand" size={16} />
              Open full view
            </button>
            <button
              type="button"
              onClick={() => (isLast ? goTo(0) : goTo(stageIndex + 1))}
              className="inline-flex min-h-11 items-center gap-(--space-2) rounded-md bg-aid-action px-(--space-4) text-small font-semibold text-aid-action-text transition-[background-color,transform] duration-(--duration-feedback) hover:bg-aid-action-hover active:translate-y-px"
            >
              {isLast ? "Start again" : `Next: ${nextLabel ?? ""}`}
              {isLast ? null : <Icon name="arrow-right" size={16} />}
            </button>
          </div>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
      </div>

      <StaticWalkthrough task={heroTasks[0] ?? task} />

      {expanded ? <ExpandedDemo onClose={() => setExpanded(false)} /> : null}
      <a
        href={routes.aiData.demonstrator()}
        className="inline-flex min-h-11 items-center gap-(--space-2) self-start text-small font-semibold text-aid-link underline underline-offset-4 hover:text-aid-link-hover"
      >
        Try the full demonstrator
        <Icon name="arrow-right" size={16} />
      </a>
    </div>
  );
}
