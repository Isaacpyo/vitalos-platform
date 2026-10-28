import { deliveryLoop } from "../../features/ai-data/copy";

/**
 * The delivery loop, Discover → Diagnose → Build → Evaluate → Deploy → Operate → Improve, drawn in
 * code (no image asset). From md up it is an SVG ring with one node per step; below md, where the
 * ring's labels would be too small to read, the same steps are a numbered list. Only one of the
 * two is displayed at a time, so assistive technology meets the steps once. Colours are the
 * band's `--aid-*` roles; nothing moves.
 */

const SIZE = { width: 640, height: 400 };
const CENTRE = { x: 320, y: 200 };
const RADIUS = 140;
const LABEL_GAP = 22;

const point = (angle: number, radius: number) => ({
  x: CENTRE.x + radius * Math.cos(angle),
  y: CENTRE.y + radius * Math.sin(angle),
});

const round = (value: number) => Math.round(value * 10) / 10;

export function DeliveryLoop({ id, caption }: Readonly<{ id: string; caption?: string }>) {
  const steps = deliveryLoop;
  const step = (2 * Math.PI) / steps.length;
  const angleOf = (index: number) => -Math.PI / 2 + index * step;
  // Arc from just after one node to just before the next, so arrowheads stop short of the node.
  const inset = 0.16;
  const arcs = steps.map((_, index) => {
    const from = point(angleOf(index) + inset, RADIUS);
    const to = point(angleOf(index + 1) - inset, RADIUS);
    return `M ${round(from.x)} ${round(from.y)} A ${RADIUS} ${RADIUS} 0 0 1 ${round(to.x)} ${round(to.y)}`;
  });
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  return (
    <figure className="m-0 flex flex-col gap-(--space-5)">
      <svg
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        className="hidden h-auto w-full max-w-160 md:block"
      >
        <title id={titleId}>The delivery loop</title>
        <desc id={descId}>
          {steps.join(", then ")}, and back to Discover with what was learned.
        </desc>
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9" className="fill-none stroke-aid-line" strokeWidth="1.5" />
          </marker>
        </defs>
        <circle
          cx={CENTRE.x}
          cy={CENTRE.y}
          r={RADIUS - 46}
          className="fill-none stroke-aid-border"
          strokeDasharray="2 6"
        />
        {arcs.map((d, index) => (
          <path
            key={d}
            d={d}
            className="fill-none stroke-aid-line"
            strokeWidth={index === steps.length - 1 ? 1.5 : 1.25}
            strokeDasharray={index === steps.length - 1 ? "5 5" : undefined}
            markerEnd={`url(#${id}-arrow)`}
          />
        ))}
        {steps.map((label, index) => {
          const angle = angleOf(index);
          const node = point(angle, RADIUS);
          const text = point(angle, RADIUS + LABEL_GAP);
          const cos = Math.cos(angle);
          const anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
          const dy = Math.sin(angle) < -0.9 ? -6 : Math.sin(angle) > 0.5 ? 14 : 5;
          return (
            <g key={label}>
              <circle
                cx={round(node.x)}
                cy={round(node.y)}
                r="7"
                className="fill-aid-bg stroke-aid-accent"
                strokeWidth="2"
              />
              <text
                x={round(text.x)}
                y={round(text.y + dy)}
                textAnchor={anchor}
                className="fill-aid-heading font-sans text-[15px] font-semibold"
              >
                <tspan className="fill-aid-muted font-mono text-[12px] font-normal">
                  {String(index + 1).padStart(2, "0")}{" "}
                </tspan>
                {label}
              </text>
            </g>
          );
        })}
        <text
          x={CENTRE.x}
          y={CENTRE.y - 4}
          textAnchor="middle"
          className="fill-aid-heading font-sans text-[15px] font-semibold"
        >
          One owner, end to end
        </text>
        <text
          x={CENTRE.x}
          y={CENTRE.y + 18}
          textAnchor="middle"
          className="fill-aid-muted font-sans text-[13px]"
        >
          each cycle starts from
        </text>
        <text
          x={CENTRE.x}
          y={CENTRE.y + 36}
          textAnchor="middle"
          className="fill-aid-muted font-sans text-[13px]"
        >
          what the last one measured
        </text>
      </svg>
      <ol className="m-0 grid list-none grid-cols-1 gap-0 border-t border-aid-border p-0 min-[400px]:grid-cols-2 md:hidden">
        {steps.map((label, index) => (
          <li
            key={label}
            className="flex items-baseline gap-(--space-3) border-b border-aid-border py-(--space-3)"
          >
            <span className="font-mono text-small text-aid-muted">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-semibold text-aid-heading">{label}</span>
          </li>
        ))}
        <li className="col-span-full py-(--space-3) text-small text-aid-muted">
          Then back to Discover, starting from what was measured.
        </li>
      </ol>
      {caption ? (
        <figcaption className="m-0 max-w-(--container-prose) text-small text-aid-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
