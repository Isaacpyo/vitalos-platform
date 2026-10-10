"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { type HTMLMotionProps, type Transition, type Variants } from "motion/react";
import * as m from "motion/react-m";
import { EASE_EMPHASIS, MotionIsland, SECONDS, useMotionAllowed } from "./_internal/island";

export type RevealDelay = 0 | 1 | 2 | 3 | 4;

type RevealTag = "div" | "li" | "ol" | "ul" | "section" | "article";

export interface RevealProps {
  as?: RevealTag;
  /** Start delay in 80ms steps (for a group, before its first item). */
  delay?: RevealDelay;
  /**
   * Make this a group: the element itself does not move; the `RevealItem`s inside it enter one
   * after another, `true` for the default step (60ms) or a step in seconds.
   */
  stagger?: boolean | number;
  className?: string | undefined;
  id?: string | undefined;
  style?: CSSProperties | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  children?: ReactNode;
}

/** Phases: `static` renders no motion styles at all (server HTML, reduced motion, above the fold). */
type Phase = "static" | "hidden" | "shown";

/** The clip extends 1rem past the box so focus outlines and the card hover lift are never cut. */
const OPEN_CLIP = "inset(-1rem -1rem -1rem -1rem)";
const SHUT_CLIP = "inset(-1rem -1rem 100% -1rem)";

const entrance = (delay: number): Transition => ({
  duration: SECONDS.entrance,
  ease: EASE_EMPHASIS,
  delay,
});

const selfVariants = (delay: number): Variants => ({
  static: {},
  hidden: { y: 24, clipPath: SHUT_CLIP, transition: { duration: 0 } },
  shown: {
    y: 0,
    clipPath: OPEN_CLIP,
    transition: entrance(delay),
    // Drop the clip once the entrance is over, so nothing (a hover lift, a focus ring) is cut.
    transitionEnd: { clipPath: "none" },
  },
});

const groupVariants = (step: number, delay: number): Variants => ({
  static: {},
  hidden: { transition: { duration: 0 } },
  shown: { transition: { staggerChildren: step, delayChildren: delay } },
});

/**
 * Optional section entrance (Stage 9 section 11: 200 to 400ms, never gates content), on Motion
 * (ADR-024).
 *
 * Progressive by construction:
 * - The server HTML and the hydrated markup carry no motion styles at all (`static`), so the
 *   content is complete and visible without JavaScript, and nothing is ever at opacity 0.
 * - After hydration, and only when motion is allowed, an element that starts below the fold is
 *   lowered by 24px and clipped (it is off screen, so nobody sees it hide). When it scrolls into
 *   view it rises while the clip wipes it in, once. Anything on or above the screen is left alone.
 * - No opacity is animated: text is drawn at full colour in every frame, so automated contrast
 *   checks that scroll content into view never sample a half-faded state (ADR-023).
 *
 * With `stagger`, the element is a group: it does not move itself and its `RevealItem`s enter in
 * sequence (cards in a grid, the nodes and connectors of a process diagram).
 */
/**
 * One shared set of listeners for every hidden Reveal (registered while any element is hidden).
 * A hidden element is shown:
 * - when its top passes 92% of the viewport height (checked once per frame on scroll and resize),
 *   which also covers a jump (End key, an anchor link, scroll restoration) that carries it past
 *   the viewport in one step, something an IntersectionObserver never reports;
 * - when the page is scrolled to the bottom, so a short last element that can never reach the
 *   92% line is not left clipped;
 * - when focus moves into it (Tab into content just below the line);
 * - before printing (with the print rule in the token CSS as the backstop for the frame the
 *   browser prints), so a printout never omits content that was never scrolled to.
 * Nothing stays hidden above, below or inside what the visitor is using.
 */
const watched = new Map<Element, () => void>();
let frame = 0;

function show(element: Element) {
  const reveal = watched.get(element);
  if (!reveal) return;
  watched.delete(element);
  reveal();
}

function checkWatched() {
  frame = 0;
  const line = window.innerHeight * 0.92;
  const root = document.documentElement;
  const atBottom = window.scrollY + window.innerHeight >= root.scrollHeight - 2;
  for (const element of Array.from(watched.keys())) {
    if (atBottom || element.getBoundingClientRect().top < line) show(element);
  }
  if (watched.size === 0) unlisten();
}

function scheduleCheck() {
  if (frame === 0) frame = requestAnimationFrame(checkWatched);
}

function onFocusIn(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof Node)) return;
  for (const element of Array.from(watched.keys())) {
    if (element.contains(target)) show(element);
  }
  if (watched.size === 0) unlisten();
}

function onBeforePrint() {
  for (const element of Array.from(watched.keys())) show(element);
  unlisten();
}

function listen() {
  window.addEventListener("scroll", scheduleCheck, { passive: true });
  window.addEventListener("resize", scheduleCheck, { passive: true });
  window.addEventListener("beforeprint", onBeforePrint);
  document.addEventListener("focusin", onFocusIn, true);
}

function unlisten() {
  window.removeEventListener("scroll", scheduleCheck);
  window.removeEventListener("resize", scheduleCheck);
  window.removeEventListener("beforeprint", onBeforePrint);
  document.removeEventListener("focusin", onFocusIn, true);
}

function watchUntilReached(element: Element, reveal: () => void): () => void {
  if (watched.size === 0) listen();
  watched.set(element, reveal);
  scheduleCheck();
  return () => {
    watched.delete(element);
    if (watched.size === 0) unlisten();
  };
}

export function Reveal(props: RevealProps) {
  return (
    <MotionIsland>
      <RevealInner {...props} />
    </MotionIsland>
  );
}

/** Drops undefined attributes (Motion's prop types do not accept explicit `undefined`). */
function defined(attributes: object): HTMLMotionProps<"div"> {
  return Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined));
}

function RevealInner({
  as = "div",
  delay = 0,
  stagger,
  className,
  children,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const allowed = useMotionAllowed();
  const [phase, setPhase] = useState<Phase>("static");

  // Decide once, before the browser paints the post-hydration frame: only content that starts
  // below the fold may be hidden for an entrance.
  useLayoutEffect(() => {
    if (!allowed || phase !== "static") return;
    const element = ref.current;
    if (!element) return;
    if (element.getBoundingClientRect().top >= window.innerHeight) setPhase("hidden");
    // Run once, when motion becomes allowed after hydration.
  }, [allowed]);

  // Reduced motion switched on while the page is open: release anything held back (the token CSS
  // already overrides the inline clip and offset under that preference).
  useEffect(() => {
    if (!allowed && phase === "hidden") setPhase("shown");
  }, [allowed, phase]);

  // Only a hidden element is watched, until it is shown; content left static costs nothing.
  useEffect(() => {
    const element = ref.current;
    if (phase !== "hidden" || !element) return;
    return watchUntilReached(element, () => setPhase("shown"));
  }, [phase]);

  const group = stagger !== undefined && stagger !== false;
  const step = typeof stagger === "number" ? stagger : 0.06;
  const Component = m[as] as typeof m.div;
  return (
    <Component
      ref={ref as React.Ref<HTMLDivElement>}
      data-reveal={group ? "group" : ""}
      data-reveal-state={phase}
      initial={false}
      animate={phase}
      variants={group ? groupVariants(step, delay * 0.08) : selfVariants(delay * 0.08)}
      {...defined({ className, ...rest })}
    >
      {children}
    </Component>
  );
}

export type RevealItemEffect = "rise" | "pop" | "draw";

/** Element attributes a RevealItem passes through (Motion owns the animation and drag events). */
type PassThrough = Omit<
  ComponentPropsWithoutRef<"li">,
  | "style"
  | "children"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDragExit"
  | "onDrop"
>;

export interface RevealItemProps extends PassThrough {
  as?: "div" | "li" | "span";
  /** rise: the card entrance; pop: a diagram node scales in; draw: a connector draws from the left. */
  effect?: RevealItemEffect;
  style?: CSSProperties | undefined;
  children?: ReactNode;
}

const itemVariants: Record<RevealItemEffect, Variants> = {
  rise: {
    static: {},
    hidden: { y: 16, clipPath: SHUT_CLIP, transition: { duration: 0 } },
    shown: {
      y: 0,
      clipPath: OPEN_CLIP,
      transition: { duration: SECONDS.entrance, ease: EASE_EMPHASIS },
      transitionEnd: { clipPath: "none" },
    },
  },
  pop: {
    static: {},
    hidden: { scale: 0, transition: { duration: 0 } },
    shown: { scale: 1, transition: { duration: SECONDS.entrance, ease: EASE_EMPHASIS } },
  },
  draw: {
    static: {},
    hidden: { scaleX: 0, transition: { duration: 0 } },
    shown: { scaleX: 1, transition: { duration: SECONDS.diagram, ease: EASE_EMPHASIS } },
  },
};

/**
 * One member of a `Reveal stagger` group. It follows the group's phase (it has no state of its
 * own), so it is static on the server, without JavaScript and under reduced motion. Must be
 * rendered inside a group; on its own it never moves.
 */
export function RevealItem({ as = "div", effect = "rise", children, ...rest }: RevealItemProps) {
  const Component = m[as] as typeof m.div;
  return (
    <Component data-reveal-item="" variants={itemVariants[effect]} {...defined(rest)}>
      {children}
    </Component>
  );
}
