"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Icon } from "@vitalos/ui";
import type { DemoRow } from "../../features/ai-data/demo-labels";
import type { OverlayTone } from "./overlays-impl";

/**
 * Stand-ins for the Base UI overlays. Each renders an ordinary button that looks and reads the
 * same. Pointing at or focusing it starts fetching the overlay module (`preload`); pressing it
 * mounts the real overlay, which opens at once and takes focus. Until a visitor reaches for one,
 * no overlay code is downloaded or run, which keeps Base UI out of the initial JavaScript.
 */

const loadImpl = () => import("./overlays-impl");

const infoClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-aid-muted transition-colors duration-(--duration-feedback) hover:text-aid-heading active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aid-focus";

const reviewerClass =
  "inline-flex min-h-11 items-center gap-(--space-2) rounded-md border border-aid-line/50 px-(--space-3) text-small font-semibold text-aid-heading transition-[border-color,transform] duration-(--duration-feedback) hover:border-aid-line active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aid-focus";

function InfoStandIn({ label, onPress }: Readonly<{ label: string; onPress?: () => void }>) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded="false"
      aria-busy={onPress ? undefined : true}
      className={infoClass}
      onPointerEnter={() => void loadImpl()}
      onFocus={() => void loadImpl()}
      onClick={onPress}
    >
      <Icon name="info" size={16} />
    </button>
  );
}

function ReviewerStandIn({ onPress }: Readonly<{ onPress?: () => void }>) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-busy={onPress ? undefined : true}
      className={reviewerClass}
      onPointerEnter={() => void loadImpl()}
      onFocus={() => void loadImpl()}
      onClick={onPress}
    >
      <Icon name="person" size={16} />
      See the reviewer task
    </button>
  );
}

const ExplainImpl = dynamic(() => loadImpl().then((m) => m.ExplainImpl), {
  ssr: false,
  loading: () => <InfoStandIn label="Loading explanation" />,
});
const ReviewerImpl = dynamic(() => loadImpl().then((m) => m.ReviewerImpl), {
  ssr: false,
  loading: () => <ReviewerStandIn />,
});

/** An (i) button that opens a short explanation. The same words are also on the page nearby. */
export function ExplainButton({
  label,
  title,
  text,
  tone,
}: Readonly<{ label: string; title: string; text: string; tone: OverlayTone }>) {
  const [pressed, setPressed] = useState(false);
  if (!pressed) return <InfoStandIn label={label} onPress={() => setPressed(true)} />;
  return (
    <ExplainImpl
      label={label}
      title={title}
      text={text}
      tone={tone}
      className={infoClass}
      autoOpen
      autoFocus
    />
  );
}

export function ReviewerTaskButton({
  row,
  statement,
  money,
  tone,
}: Readonly<{
  row: DemoRow;
  statement: string | undefined;
  money: (pence: number) => string;
  tone: OverlayTone;
}>) {
  const [pressed, setPressed] = useState(false);
  if (!pressed) return <ReviewerStandIn onPress={() => setPressed(true)} />;
  return (
    <ReviewerImpl
      row={row}
      tone={tone}
      className={reviewerClass}
      autoOpen
      autoFocus
      statement={statement}
      money={money}
    />
  );
}
