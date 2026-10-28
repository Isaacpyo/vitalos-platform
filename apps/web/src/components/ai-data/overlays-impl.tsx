"use client";

import { useEffect, useRef } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vitalos/ui/interactive";
import { Icon } from "@vitalos/ui";
import type { DemoRow } from "../../features/ai-data/demo-labels";
import { MethodChip, StatusBadge } from "./work-surface";

/**
 * The Base UI backed overlays of the demonstrator: an explanation popover and the reviewer-task
 * drawer. This module is only ever loaded by `next/dynamic` after a visitor reaches for one
 * (see lazy-overlays.tsx), so Base UI stays out of the initial JavaScript of every route.
 */

export type OverlayTone = "dark" | "light" | "muted";

export interface ExplainImplProps {
  label: string;
  title: string;
  text: string;
  tone: OverlayTone;
  className: string;
  /** Open straight away and take focus: the visitor already clicked the stand-in button. */
  autoOpen: boolean;
  /** Take focus on mount: the visitor had focus on the stand-in button this replaces. */
  autoFocus: boolean;
}

export function ExplainImpl({
  label,
  title,
  text,
  tone,
  className,
  autoOpen,
  autoFocus,
}: ExplainImplProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <Popover defaultOpen={autoOpen}>
      <PopoverTrigger ref={ref} className={className} aria-label={label}>
        <Icon name="info" size={16} />
      </PopoverTrigger>
      <PopoverContent title={title} data-aid-tone={tone}>
        <p className="m-0 text-small">{text}</p>
      </PopoverContent>
    </Popover>
  );
}

export interface ReviewerImplProps {
  row: DemoRow;
  tone: OverlayTone;
  className: string;
  autoOpen: boolean;
  autoFocus: boolean;
  statement: string | undefined;
  money: (pence: number) => string;
}

/** The task a reviewer would see for one exception. An illustration: it has no live buttons. */
export function ReviewerImpl({
  row,
  tone,
  className,
  autoOpen,
  autoFocus,
  statement,
  money,
}: ReviewerImplProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <Drawer defaultOpen={autoOpen}>
      <DrawerTrigger ref={ref} className={className}>
        <Icon name="person" size={16} />
        See the reviewer task
      </DrawerTrigger>
      <DrawerContent
        title={`Reviewer task: ${row.reference}`}
        description="An illustration of what a reviewer would see. Synthetic data; the options are described, not live."
        data-aid-tone={tone}
      >
        <div className="flex flex-col gap-(--space-4)">
          <div className="flex flex-wrap items-center gap-(--space-2)">
            <StatusBadge status={row.status} />
            <MethodChip method="code" />
            <span className="text-small text-tone-muted">found this exception</span>
          </div>
          <dl className="m-0 grid grid-cols-2 gap-(--space-3) text-small">
            <div>
              <dt className="text-tone-muted">Statement</dt>
              <dd className="m-0 font-mono font-semibold">
                {row.statementAmount === null ? "Not listed" : money(row.statementAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-tone-muted">Ledger</dt>
              <dd className="m-0 font-mono font-semibold">
                {row.ledgerAmount === null ? "No entry" : money(row.ledgerAmount)}
              </dd>
            </div>
          </dl>
          <p className="m-0">{row.note}</p>
          {statement ? (
            <pre
              tabIndex={0}
              role="region"
              aria-label="Cited statement line"
              className="m-0 overflow-x-auto rounded-md border border-tone-border p-(--space-3) font-mono text-[0.8125rem]"
            >
              Line {row.line}: {statement}
            </pre>
          ) : null}
          <div className="flex flex-col gap-(--space-2) border-t border-tone-border pt-(--space-4)">
            <p className="m-0 flex items-center gap-(--space-2) font-semibold text-tone-heading">
              <MethodChip method="person" />
              The reviewer decides
            </p>
            <ul className="m-0 flex list-disc flex-col gap-(--space-1) pl-(--space-5)">
              <li>Accept the statement figure as correct</li>
              <li>Correct the record and say why</li>
              <li>Reject the line and query it with the supplier</li>
            </ul>
            <p className="m-0 text-small text-tone-muted">
              The decision is recorded. Nothing is posted to the accounts automatically.
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
