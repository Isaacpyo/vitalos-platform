/** 2px stroke icons (section 4.1), currentColor, aria-hidden. */
type IconName =
  | "close"
  | "more"
  | "send"
  | "thumbUp"
  | "thumbDown"
  | "copy"
  | "chevron"
  | "arrow"
  | "document"
  | "gear"
  | "people"
  | "chat";

const PATHS: Record<IconName, string> = {
  close: "M6 6l12 12M18 6L6 18",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  send: "M3.5 4.5L21 12 3.5 19.5 6.5 12zM6.5 12H12",
  thumbUp: "M7 11v9H4v-9h3zm0 0l4-7c1.5 0 2.5 1 2 3l-1 4h6l-2 9H7",
  thumbDown: "M7 13V4H4v9h3zm0 0l4 7c1.5 0 2.5-1 2-3l-1-4h6l-2-9H7",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  chevron: "M9 6l6 6-6 6",
  arrow: "M5 12h13M13 6l6 6-6 6",
  document: "M14 3H6.5v18h11V6.5zM14 3v3.5h3.5M9 9h2M9 13h6M9 17h6",
  gear: "M18.5 12a6.5 6.5 0 1 1-13 0a6.5 6.5 0 1 1 13 0zM14.5 12a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0zM18.5 12h3M5.5 12h-3M12 18.5v3M12 5.5v-3M16.6 16.6l2.1 2.1M7.4 16.6l-2.1 2.1M7.4 7.4L5.3 5.3M16.6 7.4l2.1-2.1",
  people:
    "M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7zM2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2a5 5 0 0 1 3 4.8v1",
  chat: "M12 4c4.97 0 9 3.13 9 7s-4.03 7-9 7c-1.1 0-2.15-.15-3.12-.43L4 19.5l1.4-3.6C3.9 14.6 3 12.9 3 11c0-3.87 4.03-7 9-7z",
};

/** The welcome and composer glyphs use round caps and joins, as in the welcome design. */
const ROUND: ReadonlySet<IconName> = new Set(["send", "document", "gear", "people", "chat"]);

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const dots = name === "more";
  const round = ROUND.has(name);
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
      strokeLinecap={round ? "round" : "square"}
      strokeLinejoin={round ? "round" : "miter"}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Stop generating: a filled 12px square. */
export function StopSquare() {
  return <span aria-hidden="true" className="relay-stop-square" />;
}
