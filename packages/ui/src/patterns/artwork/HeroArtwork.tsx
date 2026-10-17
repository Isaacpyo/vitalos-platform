import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import { convergence, pick, polyline, rise30, rise60, seeded } from "./geometry";

/**
 * The page families of the public site (ADR-044). Each family has its own composition, so a
 * visitor can tell at a glance which part of the site a page belongs to; items inside a family
 * (each practice, solution, offer, industry, lab asset, role) get their own deterministic variant
 * from their seed.
 */
export const artworkFamilies = [
  "home",
  "what-we-do",
  "industries",
  "about",
  "labs",
  "insights",
  "careers",
  "trust",
  "contact",
  "not-found",
  "legal",
] as const;

export type ArtworkFamily = (typeof artworkFamilies)[number];

/** A family and the item seed that picks its variant (usually the item's slug). */
export interface ArtworkSpec {
  family: ArtworkFamily;
  seed?: string | undefined;
}

export interface HeroArtworkProps extends ArtworkSpec {
  /**
   * `full`: the whole composition, anchored to the right edge (the copy sits on the left).
   * `strip`: only its centre, for a short band under the copy on compact screens.
   */
  crop?: "full" | "strip";
  /** The bands slide in once on load (motion-safe only; the homepage hero). */
  animate?: boolean | undefined;
  className?: string | undefined;
}

/*
 * Drawing rules (brand book, "Graphic language"; tokens only, no gradients, glows or
 * transparency): the 12-column grid as hairlines in the tone's line colour; the Convergence in
 * cobalt (strategy, above) and mineral (engineering, below) at 30 degrees; paths horizontal or at
 * 30/60 degrees; hollow nodes are pending, cobalt nodes decided, the mineral node the outcome;
 * one or two annotation marks (a 12-step ruler, crop marks). Colours come from the tone scope
 * (`stroke-tone-border`, `fill-tone-bg`), so one drawing works on the dark and the light hero.
 */

const W = 1200;
const H = 600;
const OFF = W + 60; // past the right edge: paths leave the frame

type Next = () => number;

function Grid() {
  const columns = [600, 700, 800, 900, 1000, 1100];
  return (
    <g className="stroke-tone-border" strokeWidth={1} vectorEffect="non-scaling-stroke">
      {columns.map((x) => (
        <line key={x} x1={x} x2={x} y1={0} y2={H} vectorEffect="non-scaling-stroke" />
      ))}
      <line x1={560} x2={W} y1={120} y2={120} vectorEffect="non-scaling-stroke" />
      <line x1={560} x2={W} y1={480} y2={480} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function Ruler({ x, y, length }: { x: number; y: number; length: number }) {
  const step = length / 12;
  return (
    <g className="stroke-tone-muted" strokeWidth={1} fill="none">
      <line x1={x} x2={x + length} y1={y} y2={y} vectorEffect="non-scaling-stroke" />
      {Array.from({ length: 13 }, (_, index) => (
        <line
          key={index}
          x1={x + index * step}
          x2={x + index * step}
          y1={y}
          y2={y - (index % 3 === 0 ? 14 : 7)}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

function CropMarks({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const l = 18;
  const d = [
    `M${x1 - l} ${y1}H${x1}V${y1 - l}`,
    `M${x2 + l} ${y1}H${x2}V${y1 - l}`,
    `M${x1 - l} ${y2}H${x1}V${y2 + l}`,
    `M${x2 + l} ${y2}H${x2}V${y2 + l}`,
  ].join("");
  return (
    <path
      d={d}
      className="stroke-tone-muted"
      strokeWidth={1}
      fill="none"
      strokeLinecap="square"
      vectorEffect="non-scaling-stroke"
    />
  );
}

type NodeKind = "pending" | "decided" | "outcome";

function Node({ x, y, kind, size = 10 }: { x: number; y: number; kind: NodeKind; size?: number }) {
  if (kind === "pending") {
    return (
      <circle
        cx={x}
        cy={y}
        r={size}
        className="fill-tone-bg stroke-blue-600"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  return (
    <circle
      cx={x}
      cy={y}
      r={size}
      className={kind === "outcome" ? "fill-aqua-600" : "fill-blue-600"}
    />
  );
}

function Bands(props: Parameters<typeof convergence>[0]) {
  const { strategy, engineering } = convergence(props);
  return (
    <>
      <polygon points={strategy} className="fill-blue-600" />
      <polygon points={engineering} className="fill-aqua-600" />
    </>
  );
}

function Path({ d, width = 2 }: { d: string; width?: number }) {
  return (
    <path
      d={d}
      className="stroke-blue-600"
      strokeWidth={width}
      fill="none"
      strokeLinecap="square"
      strokeLinejoin="miter"
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** Nodes along a run: the first `decided` are cobalt, then pending, the last is the outcome. */
function kinds(count: number, decided: number): NodeKind[] {
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? "outcome" : index < decided ? "decided" : "pending",
  );
}

/** Home: the Convergence at full scale, entering on a column line and leaving the frame. */
function home(): ReactNode {
  return (
    <>
      <Bands startX={600} mergeX={840} axisY={330} upper={120} lower={74} gap={8} endX={OFF} />
      <Ruler x={884} y={150} length={264} />
    </>
  );
}

/** What We Do (practices, solutions, offers): a smaller Convergence with a decision path. */
function whatWeDo(next: Next): ReactNode {
  const mergeX = 760 + pick(next, 0, 4) * 30;
  const axisY = 316 + pick(next, -2, 2) * 10;
  const upper = 84;
  const bandTop = axisY - 4 - upper;
  const start: [number, number] = [mergeX + 20, bandTop - 16];
  const lift: [number, number] = [mergeX + 20 + 45 / Math.tan(Math.PI / 3), bandTop - 61];
  const count = pick(next, 3, 5);
  const decided = pick(next, 1, count - 2);
  const from = lift[0] + 60;
  const gapX = (1160 - from) / (count - 1);
  return (
    <>
      <Bands startX={600} mergeX={mergeX} axisY={axisY} upper={upper} lower={52} gap={6} endX={OFF} />
      <Path d={polyline([start, lift, [OFF, lift[1]]])} />
      <Node x={start[0]} y={start[1]} kind="pending" size={8} />
      {kinds(count, decided).map((kind, index) => (
        <Node key={index} x={from + index * gapX} y={lift[1]} kind={kind} size={9} />
      ))}
    </>
  );
}

/** Industries: a site plan of orthogonal blocks over a thin Convergence. */
function industries(next: Next): ReactNode {
  const cells: { x: number; y: number }[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 5; column += 1) cells.push({ x: 640 + column * 104, y: 140 + row * 100 });
  }
  const field = pick(next, 0, cells.length - 1);
  const outcome = (field + pick(next, 3, cells.length - 3)) % cells.length;
  return (
    <>
      {cells.map((cell, index) => {
        const roll = next();
        if (index !== field && index !== outcome && roll < 0.3) return null;
        const accent = index !== field && roll > 0.82;
        return (
          <rect
            key={index}
            x={cell.x + 8}
            y={cell.y + 8}
            width={88}
            height={84}
            className={
              index === field
                ? "fill-blue-600"
                : cx("fill-none", accent ? "stroke-blue-600" : "stroke-tone-border")
            }
            strokeWidth={index === field ? 0 : accent ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {(() => {
        const cell = cells[outcome] ?? cells[0]!;
        return <rect x={cell.x + 36} y={cell.y + 34} width={32} height={32} className="fill-aqua-600" />;
      })()}
      <Bands startX={600} mergeX={720} axisY={458} upper={26} lower={16} gap={4} endX={OFF} />
    </>
  );
}

/** About and How We Work: the nine stages as a rising path of nodes. */
function about(next: Next): ReactNode {
  const stepX = 64;
  const riseY = 34;
  const nodes: [number, number][] = [];
  const route: [number, number][] = [];
  for (let index = 0; index < 9; index += 1) {
    const x = 620 + index * stepX;
    const y = 430 - index * riseY;
    nodes.push([x, y]);
    route.push([x, y]);
    if (index < 8) {
      const runEnd = x + stepX - riseY / Math.tan(Math.PI / 3);
      route.push([runEnd, y]);
    }
  }
  const last = nodes[8]!;
  route.push([OFF, last[1]]);
  const decided = pick(next, 2, 6);
  return (
    <>
      <Path d={polyline(route)} />
      {nodes.map(([x, y], index) => (
        <Node key={index} x={x} y={y} kind={kinds(9, decided)[index]!} size={index === 8 ? 12 : 9} />
      ))}
      <Ruler x={640} y={470} length={252} />
    </>
  );
}

/** Labs: a specimen matrix of small nodes with one orthogonal trial path. */
function labs(next: Next): ReactNode {
  const columns = 7;
  const rows = 4;
  const at = (column: number, row: number): [number, number] => [640 + column * 86, 172 + row * 86];
  let column = 0;
  let row = pick(next, 0, rows - 1);
  const route: [number, number][] = [at(column, row)];
  while (column < columns - 1) {
    if (next() < 0.55 || row === 0 || row === rows - 1) {
      column += 1;
    } else {
      row += next() < 0.5 ? -1 : 1;
    }
    route.push(at(column, row));
  }
  const dots: ReactNode[] = [];
  for (let c = 0; c < columns; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const [x, y] = at(c, r);
      dots.push(
        <circle
          key={`${c}-${r}`}
          cx={x}
          cy={y}
          r={5}
          className="fill-tone-bg stroke-tone-muted"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />,
      );
    }
  }
  const end = route[route.length - 1]!;
  return (
    <>
      <CropMarks x1={606} y1={140} x2={1190} y2={460} />
      {dots}
      <Path d={polyline(route)} />
      {route.slice(0, -1).map(([x, y], index) =>
        index % 2 === 0 ? <Node key={index} x={x} y={y} kind="decided" size={7} /> : null,
      )}
      <Node x={end[0]} y={end[1]} kind="outcome" size={11} />
    </>
  );
}

/** Insights: an editorial page, ruled lines beside one confident cobalt field. */
function insights(next: Next): ReactNode {
  const lines = Array.from({ length: 10 }, (_, index) => ({
    y: 168 + index * 28,
    length: 120 + pick(next, 0, 5) * 24,
  }));
  return (
    <>
      <rect x={900} y={150} width={W - 900} height={186} className="fill-blue-600" />
      <rect x={620} y={146} width={56} height={8} className="fill-aqua-600" />
      <g className="stroke-tone-muted" strokeWidth={2} vectorEffect="non-scaling-stroke">
        {lines.map((line) => (
          <line
            key={line.y}
            x1={620}
            x2={Math.min(620 + line.length, 860)}
            y1={line.y}
            y2={line.y}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {lines.slice(7).map((line) => (
          <line
            key={`r${line.y}`}
            x1={900}
            x2={900 + line.length}
            y1={line.y}
            y2={line.y}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </>
  );
}

/** Careers: the rising staircase, fields growing in height and brightness. */
function careers(next: Next): ReactNode {
  const fills = ["fill-midnight-800", "fill-blue-700", "fill-blue-600", "fill-aqua-600"] as const;
  const lift = pick(next, 0, 3) * 10;
  return (
    <>
      {fills.map((fill, index) => {
        const height = 90 + index * 80 + lift;
        return (
          <rect key={fill} x={700 + index * 120} y={470 - height} width={108} height={height} className={fill} />
        );
      })}
      <Ruler x={700} y={500} length={468} />
    </>
  );
}

/** Trust Centre: nested orthogonal frames around one verified outcome. */
function trust(next: Next): ReactNode {
  const cx0 = 880 + pick(next, -1, 1) * 20;
  const cy0 = 300;
  const frame = (half: number) => ({ x: cx0 - half, y: cy0 - half, width: half * 2, height: half * 2 });
  return (
    <>
      <rect {...frame(160)} className="fill-none stroke-tone-border" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <rect {...frame(110)} className="fill-none stroke-blue-600" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <rect {...frame(60)} className="fill-none stroke-blue-600" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <CropMarks x1={cx0 - 160} y1={cy0 - 160} x2={cx0 + 160} y2={cy0 + 160} />
      <Path d={polyline([[cx0 + 60, cy0], [OFF, cy0]])} />
      <Node x={cx0} y={cy0} kind="outcome" size={16} />
    </>
  );
}

/** Contact and FAQ: two lines of conversation meeting at one node, then one path out. */
function contact(): ReactNode {
  const meet: [number, number] = [880, 300];
  const run = meet[0] - 620;
  return (
    <>
      <path
        d={polyline([[620, meet[1] - 7 - rise30(run)], [meet[0], meet[1] - 7]])}
        className="stroke-blue-600"
        strokeWidth={14}
        fill="none"
      />
      <path
        d={polyline([[620, meet[1] + 6 + rise30(run)], [meet[0], meet[1] + 6]])}
        className="stroke-aqua-600"
        strokeWidth={9}
        fill="none"
      />
      <Path d={polyline([meet, [OFF, meet[1]]])} width={2} />
      <Node x={620} y={meet[1] - 7 - rise30(run)} kind="pending" size={10} />
      <Node x={620} y={meet[1] + 6 + rise30(run)} kind="pending" size={10} />
      <Node x={1040} y={meet[1]} kind="pending" size={8} />
      <Node x={meet[0]} y={meet[1]} kind="outcome" size={20} />
    </>
  );
}

/** 404: the Convergence stops short with a clean cut; the path ahead is a pending hairline. */
function notFound(): ReactNode {
  return (
    <>
      <Bands startX={600} mergeX={800} axisY={300} upper={84} lower={52} gap={6} endX={1000} />
      <path
        d="M1040 300H1260"
        className="stroke-tone-muted"
        strokeWidth={1}
        strokeDasharray="4 8"
        vectorEffect="non-scaling-stroke"
      />
      <Node x={1100} y={300} kind="pending" size={10} />
    </>
  );
}

/** Legal: the grid and a single rule. */
function legal(): ReactNode {
  return (
    <>
      <rect x={600} y={444} width={W - 600} height={8} className="fill-blue-600" />
      <rect x={600} y={458} width={96} height={5} className="fill-aqua-600" />
      <Ruler x={640} y={420} length={240} />
    </>
  );
}

const compositions: Record<ArtworkFamily, (next: Next) => ReactNode> = {
  home,
  "what-we-do": whatWeDo,
  industries,
  about,
  labs,
  insights,
  careers,
  trust,
  contact,
  "not-found": notFound,
  legal,
};

/**
 * Brand-system hero artwork (ADR-044): a deterministic SVG drawn from the brand's graphic
 * language, in place of photographs. Decorative and hidden from assistive technology; it carries
 * no text. Server-rendered, a few kilobytes, so it never delays the page's largest paint.
 */
export function HeroArtwork({ family, seed, crop = "full", animate, className }: HeroArtworkProps) {
  const next = seeded(`${family}:${seed ?? family}`);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-artwork={family}
      viewBox={crop === "strip" ? "560 140 640 320" : `0 0 ${W} ${H}`}
      preserveAspectRatio={crop === "strip" ? "xMidYMid slice" : "xMaxYMid slice"}
      className={cx("pointer-events-none block select-none", className)}
    >
      <Grid />
      <g
        className={
          animate
            ? "motion-safe:animate-[hero-plane_var(--duration-diagram)_var(--ease-emphasis)_both]"
            : undefined
        }
      >
        {compositions[family](next)}
      </g>
    </svg>
  );
}
