import type { ReactNode } from "react";
import { Icon } from "@vitalos/ui";
import type { DemoStatus } from "../../features/ai-data/demo-labels";
import { demoStatusLabels } from "../../features/ai-data/demo-labels";

/**
 * Small pieces shared by the AI & Data work surfaces (hero walkthrough, reconciliation preview,
 * demonstrator). No state of their own and no client directive: they render on the server and
 * inside client islands alike. Colours are the `--aid-*` roles only.
 */

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/**
 * Smooth expansion of a region (evidence, details). The content stays in the DOM, collapsed to
 * zero height, and is `inert` while closed so it cannot be focused or read out of context.
 * Under reduced motion the height change is instant (the duration token collapses).
 */
export function Expand({
  open,
  id,
  children,
}: Readonly<{ open: boolean; id?: string; children: ReactNode }>) {
  return (
    <div
      id={id}
      inert={!open}
      className={cx(
        "grid transition-[grid-template-rows] duration-(--duration-disclosure) ease-(--ease-standard)",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div
        className={cx(
          "min-h-0 overflow-hidden transition-[visibility] duration-(--duration-disclosure)",
          !open && "invisible",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Source lines with their numbers; `marked` lines carry the teal signal. */
export function SourceLines({
  lines,
  marked = [],
  flagged = [],
  label,
  className,
}: Readonly<{
  lines: readonly { id: string; n: number; text: string }[];
  marked?: readonly string[];
  /** Lines behind an exception: a visible "!" and a screen-reader note, never colour alone. */
  flagged?: readonly string[];
  label: string;
  className?: string;
}>) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cx(
        "overflow-x-auto rounded-md border border-aid-border bg-aid-bg font-mono text-[0.8125rem] leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aid-focus",
        className,
      )}
    >
      <ol className="m-0 min-w-max list-none p-0">
        {lines.map((line) => {
          const on = marked.includes(line.id);
          return (
            <li
              key={line.id}
              data-line={line.id}
              data-marked={on || undefined}
              className={cx(
                "flex min-w-max gap-(--space-3) border-l-2 px-(--space-3) transition-colors duration-(--duration-feedback)",
                on
                  ? "border-aid-signal bg-aid-signal-soft text-aid-heading"
                  : "border-transparent text-aid-text",
              )}
            >
              <span
                aria-hidden="true"
                className="w-6 shrink-0 text-right text-aid-muted select-none"
              >
                {line.n}
              </span>
              <span
                aria-hidden="true"
                className={cx(
                  "my-0.5 w-4 shrink-0 rounded-sm text-center text-[0.75rem] leading-5 font-bold select-none",
                  flagged.includes(line.id) ? "bg-aid-warn-bg text-aid-warn" : "text-transparent",
                )}
              >
                {flagged.includes(line.id) ? "!" : "·"}
              </span>
              <span className="whitespace-pre">
                {line.text || " "}
                {on ? <span className="sr-only"> (cited line)</span> : null}
                {flagged.includes(line.id) ? <span className="sr-only"> (exception)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Who did the work: rule, AI-assisted (scripted here) or a person. Always text, never colour only. */
export function MethodChip({
  method,
}: Readonly<{ method: "rule" | "ai-assisted" | "person" | "code" }>) {
  const label = {
    rule: "Rule",
    code: "Code",
    "ai-assisted": "AI-assisted (scripted)",
    person: "Person",
  }[method];
  const icon = method === "person" ? "person" : method === "ai-assisted" ? "chip" : "code";
  return (
    <span className="inline-flex items-center gap-(--space-1) rounded-sm border border-aid-border px-(--space-2) py-0.5 text-[0.75rem] font-semibold text-aid-muted">
      <Icon name={icon} size={16} className="shrink-0" />
      {label}
    </span>
  );
}

const statusTone: Record<DemoStatus, string> = {
  matched: "bg-aid-ok-bg text-aid-ok",
  "amount-mismatch": "bg-aid-warn-bg text-aid-warn",
  duplicate: "bg-aid-warn-bg text-aid-warn",
  missing: "bg-aid-error-bg text-aid-error",
  "not-on-statement": "bg-aid-error-bg text-aid-error",
};

export function StatusBadge({ status }: Readonly<{ status: DemoStatus }>) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-(--space-1) rounded-sm px-(--space-2) py-0.5 text-small font-semibold whitespace-nowrap",
        statusTone[status],
      )}
    >
      <Icon name={status === "matched" ? "check" : "flag"} size={16} className="shrink-0" />
      {demoStatusLabels[status]}
    </span>
  );
}

/** "Synthetic data" and "Scripted example" labels that must not be missed on a work surface. */
export function ScriptedLabels({ compact = false }: Readonly<{ compact?: boolean }>) {
  return (
    <ul
      aria-label="About this example"
      className={cx(
        "m-0 flex list-none flex-wrap p-0",
        compact ? "gap-(--space-1)" : "gap-(--space-2)",
      )}
    >
      {["Synthetic data", "Scripted example, not live AI"].map((text) => (
        <li
          key={text}
          className="inline-flex items-center gap-(--space-1) rounded-sm border border-aid-line/40 bg-aid-chip-bg px-(--space-2) py-0.5 text-[0.75rem] font-semibold text-aid-chip-text"
        >
          <Icon name="info" size={16} className="shrink-0" />
          {text}
        </li>
      ))}
    </ul>
  );
}
