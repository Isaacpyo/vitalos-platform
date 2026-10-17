import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";

/**
 * Line diagrams for the six solutions (ADR-044): the icon set's language (square caps, mitred
 * joins, no fills except the brand's node colours) at panel size. They replace the glossy 3D
 * illustrations. The AI Transformation diagram is the locked AI journey as an abstract staircase
 * (assess, prototype, production, managed), never a brain, a chip or a robot.
 */
export const lineDiagramNames = [
  "ai-journey",
  "process",
  "product",
  "application",
  "data",
  "reliability",
] as const;

export type LineDiagramName = (typeof lineDiagramNames)[number];

export interface LineDiagramProps {
  name: LineDiagramName;
  className?: string | undefined;
}

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "square",
  strokeLinejoin: "miter",
  vectorEffect: "non-scaling-stroke",
} as const;

function Dot({ x, y, kind, r = 8 }: { x: number; y: number; kind: "pending" | "decided" | "outcome"; r?: number }) {
  if (kind === "pending") {
    return <circle cx={x} cy={y} r={r} {...line} className="fill-tone-bg" />;
  }
  return <circle cx={x} cy={y} r={r} className={kind === "outcome" ? "fill-aqua-600" : "fill-blue-600"} />;
}

/** AI Transformation: four fields rising in height, a node on each; the last is the outcome. */
function aiJourney(): ReactNode {
  const steps = [0, 1, 2, 3].map((index) => ({ x: 28 + index * 50, height: 40 + index * 34 }));
  return (
    <>
      <path d="M16 208H224" {...line} />
      {steps.map((step, index) => (
        <rect
          key={index}
          x={step.x}
          y={208 - step.height}
          width={36}
          height={step.height}
          {...line}
          className={index === 3 ? "fill-aqua-600 stroke-aqua-600" : undefined}
        />
      ))}
      <path d="M46 150V136H96V102H146V68H196V34" {...line} className="stroke-blue-600" />
      <Dot x={46} y={136} kind="decided" />
      <Dot x={96} y={102} kind="decided" />
      <Dot x={146} y={68} kind="decided" />
      <Dot x={196} y={34} kind="outcome" r={11} />
    </>
  );
}

/** Business Process Modernisation: a tangled route of steps becomes one straight line. */
function process(): ReactNode {
  return (
    <>
      <rect x={20} y={40} width={40} height={32} {...line} />
      <rect x={70} y={112} width={40} height={32} {...line} />
      <rect x={20} y={176} width={40} height={32} {...line} />
      <path d="M60 56H90V112M70 128H40V176" {...line} />
      <path d="M128 120h20m-8-8 8 8-8 8" {...line} />
      <path d="M164 64V200" {...line} className="stroke-blue-600" />
      <Dot x={164} y={72} kind="decided" />
      <Dot x={164} y={132} kind="decided" />
      <Dot x={164} y={192} kind="outcome" r={10} />
      <path d="M180 72h36M180 132h36M180 192h24" {...line} />
    </>
  );
}

/** Digital Product Transformation: a web screen and a phone, the same product on both. */
function product(): ReactNode {
  return (
    <>
      <rect x={16} y={48} width={160} height={116} {...line} />
      <path d="M16 72H176" {...line} />
      <rect x={16} y={48} width={160} height={24} className="fill-blue-600" />
      <path d="M36 96h64M36 116h96M36 136h48" {...line} />
      <path d="M72 192h48M96 164v28" {...line} />
      <rect x={152} y={96} width={64} height={112} {...line} className="fill-tone-bg" />
      <rect x={152} y={96} width={64} height={18} className="fill-aqua-600" />
      <path d="M166 134h36M166 150h24M166 166h30" {...line} />
    </>
  );
}

/** Application Modernisation: one monolith becomes connected modules. */
function application(): ReactNode {
  return (
    <>
      <rect x={20} y={52} width={72} height={136} {...line} />
      <path d="M20 86h72M20 120h72M20 154h72" {...line} />
      <path d="M104 120h20m-8-8 8 8-8 8" {...line} />
      <rect x={140} y={52} width={36} height={36} {...line} className="fill-blue-600 stroke-blue-600" />
      <rect x={196} y={52} width={36} height={36} {...line} />
      <rect x={140} y={152} width={36} height={36} {...line} />
      <rect x={196} y={152} width={36} height={36} {...line} className="fill-aqua-600 stroke-aqua-600" />
      <path d="M158 88v64M214 88v64M176 70h20M176 170h20" {...line} />
    </>
  );
}

/** Data & Intelligence Transformation: sources converge at 30 degrees into one measure. */
function data(): ReactNode {
  return (
    <>
      <Dot x={24} y={52} kind="pending" />
      <Dot x={24} y={120} kind="pending" />
      <Dot x={24} y={188} kind="pending" />
      <path d="M32 56 104 97.6M32 120h72M32 184l72-41.6" {...line} />
      <Dot x={116} y={120} kind="outcome" r={12} />
      <path d="M128 120h20" {...line} />
      <path d="M160 200V40M160 200h68" {...line} />
      <rect x={172} y={150} width={14} height={50} className="fill-blue-600" />
      <rect x={192} y={118} width={14} height={82} className="fill-blue-600" />
      <rect x={212} y={84} width={14} height={116} className="fill-aqua-600" />
    </>
  );
}

/** Technology Recovery & Reliability: a broken service line, restored and held. */
function reliability(): ReactNode {
  return (
    <>
      <path d="M16 96H72L86 120H100" {...line} />
      <path d="M140 120H154L168 96H224" {...line} />
      <path d="M100 120h40" {...line} className="stroke-aqua-600" strokeWidth={4} />
      <Dot x={120} y={120} kind="outcome" r={10} />
      <path d="M16 176H224" {...line} />
      <path d="M16 160v32M224 160v32" {...line} />
      <path d="M60 52a60 60 0 0 1 120 0" {...line} className="stroke-blue-600" />
      <path d="M168 40l12 12 12-12" {...line} className="stroke-blue-600" />
    </>
  );
}

const diagrams: Record<LineDiagramName, () => ReactNode> = {
  "ai-journey": aiJourney,
  process,
  product,
  application,
  data,
  reliability,
};

/** One solution diagram, decorative (the solution's title is the visible label). */
export function LineDiagram({ name, className }: LineDiagramProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-diagram={name}
      viewBox="0 0 240 240"
      className={cx("block text-tone-heading", className)}
    >
      {diagrams[name]()}
    </svg>
  );
}
