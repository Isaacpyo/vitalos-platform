/** 2px square-capped stroke icons (section 4.1), currentColor, aria-hidden. */
type IconName = "close" | "more" | "send" | "thumbUp" | "thumbDown" | "copy" | "chevron" | "arrow";

const PATHS: Record<IconName, string> = {
  close: "M6 6l12 12M18 6L6 18",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  send: "M12 19V5M5 12l7-7 7 7",
  thumbUp: "M7 11v9H4v-9h3zm0 0l4-7c1.5 0 2.5 1 2 3l-1 4h6l-2 9H7",
  thumbDown: "M7 13V4H4v9h3zm0 0l4 7c1.5 0 2.5-1 2-3l-1-4h6l-2-9H7",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  chevron: "M9 6l6 6-6 6",
  arrow: "M5 12h13M13 6l6 6-6 6",
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const dots = name === "more";
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={dots ? 3 : 2}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Stop generating: a filled 12px square. */
export function StopSquare() {
  return <span aria-hidden="true" className="relay-stop-square" />;
}

/** The Convergence (welcome header only): cobalt band above, mineral below, 30° (section 4.1). */
export function Convergence() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="relay-convergence"
      width="420"
      height="120"
      viewBox="0 0 420 120"
      preserveAspectRatio="xMaxYMin meet"
    >
      <polygon className="relay-convergence-ai" points="250,0 330,46 420,46 420,60 330,60 250,14" />
      <polygon
        className="relay-convergence-people"
        points="250,106 330,64 420,64 420,78 330,78 250,120"
      />
    </svg>
  );
}
