import type { ReactNode, SVGProps } from "react";

/**
 * Monoline icon set (Stage 9 section 9): 24px grid, 1.5px stroke, square caps, no fills. Paths use
 * `currentColor`, so icons inherit the surrounding text colour and tone.
 */
const paths = {
  "arrow-right": <path d="M4 12h15m-6-6 6 6-6 6" />,
  "arrow-up-right": <path d="M7 17 17 7m0 0H8m9 0v9" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  pause: <path d="M9 5v14m6-14v14" />,
  play: <path d="M8 5v14l11-7-11-7Z" />,
  external: <path d="M14 4h6v6m0-6-9 9M18 14v5H5V6h5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-9.5v.01" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v5m0 2.5v.01" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6m0 3.5v.01" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 3 3 5-6" />
    </>
  ),
  "arrow-left": <path d="M20 12H5m6-6-6 6 6 6" />,
  // Subject icons for icon tiles (decorative; always beside a visible label).
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  code: <path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2.5-10-3 12" />,
  chip: (
    <>
      <rect x="6" y="6" width="12" height="12" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3" />
    </>
  ),
  window: (
    <>
      <rect x="3" y="5" width="18" height="14" />
      <path d="M3 9h18M6.5 7h.01M9 7h.01" />
    </>
  ),
  server: (
    <>
      <rect x="4" y="4" width="16" height="7" />
      <rect x="4" y="13" width="16" height="7" />
      <path d="M8 7.5h.01M8 16.5h.01" />
    </>
  ),
  workflow: (
    <>
      <rect x="3" y="4" width="7" height="6" />
      <rect x="14" y="14" width="7" height="6" />
      <path d="M6.5 10v4.5a2 2 0 0 0 2 2H14" />
    </>
  ),
  layers: <path d="m12 4 8 4-8 4-8-4 8-4Zm-8 8 8 4 8-4m-16 4 8 4 8-4" />,
  chart: <path d="M4 4v16h16M8 16v-4m4 4V8m4 8v-6" />,
  flask: (
    <path d="M9 3h6m-5 0v6l-5 9.5A1.5 1.5 0 0 0 6.3 21h11.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3M7.5 15h9" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  shield: <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4" />,
  building: <path d="M4 21V5l8-2v18m0-13h8v13M3 21h18M7.5 8h1m-1 4h1m-1 4h1m7-4h1m-1 4h1" />,
  document: <path d="M6 3h8l4 4v14H6V3Zm8 0v4h4M9 12h6m-6 4h6" />,
  mail: <path d="M3 5h18v14H3V5Zm0 0 9 7.5L21 5" />,
  // Added for the pages redesign (15 Oct 2026), drawn on the same grid, stroke and caps.
  image: <path d="M3 4h18v16H3V4Zm0 12 5-5 4 4 3-3 6 6M15.5 9.5h.01" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="4.25" />
      <path d="M12 12h.01" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20M16 4.75a3.25 3.25 0 0 1 0 6.5M18 14a4.5 4.5 0 0 1 3 4.25V20" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  lock: <path d="M5 11h14v10H5V11Zm3 0V7.5a4 4 0 0 1 8 0V11m-4 4v2" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  gauge: <path d="M4.5 18a8.25 8.25 0 1 1 15 0M12 13.5l4-4.5M12 13.5h.01" />,
  link: (
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66L11.5 6.8M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.46" />
  ),
  // Added for the Health & Care pages (Website Build Pack, 25 Oct 2026), drawn on the same grid,
  // stroke and caps. The brief names Lucide icons as a guide; these are this set's own drawings.
  inbox: <path d="M3 13h5l1.5 3h5l1.5-3h5M3 13l3-8h12l3 8v7H3v-7Z" />,
  plug: <path d="M9 3v4m6-4v4M7 7h10v4a5 5 0 0 1-10 0V7Zm5 9v5" />,
  unplug: <path d="M9 3v4m6-4v4M7 7h10v4a5 5 0 0 1-10 0V7Zm5 9v5M3 3l18 18" />,
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 10v3.5l2.5 2M9.5 3h5M12 3v2.5" />
    </>
  ),
  "badge-check": (
    <path d="m12 3 2.2 1.6 2.7-.2.9 2.6L20 8.6l-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.2L12 21l-2.2-1.6-2.7.2-.9-2.6L4 15.4l.8-2.6L4 10.2 6.2 8.6 7.1 6l2.7.2L12 3Zm-3 9 2 2 4-4" />
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3V6Zm11 4h4l3 3.5V16h-7" />
      <circle cx="7" cy="17.5" r="1.75" />
      <circle cx="17" cy="17.5" r="1.75" />
    </>
  ),
  rocket: (
    <path d="M12 3c3.5 2 5 5.5 5 9l-2 4H9l-2-4c0-3.5 1.5-7 5-9Zm0 6.5h.01M9 16l-3 3v-4.5L7.5 13M15 16l3 3v-4.5L16.5 13M10.5 19.5h3" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 3v2.5m0 13V21M3 12h2.5m13 0H21M5.6 5.6l1.8 1.8m9.2 9.2 1.8 1.8M5.6 18.4l1.8-1.8m9.2-9.2 1.8-1.8" />
    </>
  ),
  bot: (
    <>
      <rect x="4" y="8" width="16" height="11" />
      <path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5M2 12v3m20-3v3" />
    </>
  ),
  "package-check": (
    <path d="M3 7.5 12 3l9 4.5V12M3 7.5v9L12 21M3 7.5l9 4.5 9-4.5M12 12v9m3-3 2 2 4-4" />
  ),
  stethoscope: (
    <>
      <path d="M6 3H5v6a4 4 0 0 0 8 0V3h-1M9 13v2a5 5 0 0 0 10 0v-2" />
      <circle cx="19" cy="11" r="2" />
    </>
  ),
  "file-lock": (
    <>
      <path d="M11 21H6V3h8l4 4v4M14 3v4h4" />
      <rect x="13" y="15" width="8" height="6" />
      <path d="M15 15v-2a2 2 0 0 1 4 0v2" />
    </>
  ),
  accessibility: (
    <>
      <circle cx="12" cy="4.5" r="1.5" />
      <path d="m5 8 7 1.5L19 8m-7 1.5V14l-3.5 6.5M12 14l3.5 6.5" />
    </>
  ),
  car: (
    <>
      <path d="M3 16v-4l2-5h14l2 5v4H3Zm0-4h18" />
      <circle cx="7.5" cy="16.5" r="1.75" />
      <circle cx="16.5" cy="16.5" r="1.75" />
    </>
  ),
  "user-x": (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20M17 8l4 4m0-4-4 4" />
    </>
  ),
  "user-round": (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  palette: (
    <path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.3-1.8-1.3-3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Zm-4.5 8h.01m1.99-4h.01m4.99 0h.01M17 10.5h.01" />
  ),
  smartphone: (
    <>
      <rect x="6.5" y="3" width="11" height="18" />
      <path d="M11 17.5h2" />
    </>
  ),
  receipt: <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21V3Zm4 5h6m-6 4h6m-6 4h3" />,
  quote: <path d="M4 12a6 6 0 0 1 4-5.5M4 12h5v5H4v-5Zm9 0a6 6 0 0 1 4-5.5M13 12h5v5h-5v-5Z" />,
  // Added for revision 2 of the Health & Care pages (Website Build Pack, 25 Oct 2026), same grid,
  // stroke and caps.
  "user-check": (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20m1.5-10 2 2 4-4" />
    </>
  ),
  "user-minus": (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20M17 10h5" />
    </>
  ),
  landmark: (
    <path d="M3 9.5 12 4l9 5.5H3Zm2 0V18m4.67-8.5V18m4.66-8.5V18M19 9.5V18M3 21h18M4 18h16" />
  ),
  package: <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0 9 4.5 9-4.5M12 12v9M7.5 5.25l9 4.5" />,
  "file-pen": <path d="M11 21H6V3h8l4 4v3M14 3v4h4m-6 14v-2.5l6-6 2.5 2.5-6 6H12Z" />,
  "file-check": <path d="M6 3h8l4 4v14H6V3Zm8 0v4h4M9 14l2 2 4-4" />,
  "file-x": <path d="M6 3h8l4 4v14H6V3Zm8 0v4h4M10 12l4 4m0-4-4 4" />,
  "file-down": <path d="M6 3h8l4 4v14H6V3Zm8 0v4h4m-6 3v6m-2.5-2.5L12 16l2.5-2.5" />,
  "file-question": (
    <path d="M6 3h8l4 4v14H6V3Zm8 0v4h4M10 11.5a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.5v.3m0 2.5v.01" />
  ),
  tags: <path d="M3 4h7l9 9-7 7-9-9V4Zm4.5 3.5h.01M13 4l8 8.5" />,
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.5" />
    </>
  ),
  history: <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 3.5V8H8M12 7.5V12l3 2" />,
  "refresh-cw": <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4" />,
  "scan-barcode": <path d="M3 8V3h5m8 0h5v5m0 8v5h-5m-8 0H3v-5M7.5 8v8m3-8v8m3-8v8m3-8v8" />,
  thermometer: (
    <>
      <path d="M10 14.5V5a2 2 0 0 1 4 0v9.5" />
      <circle cx="12" cy="17" r="3.5" />
      <path d="M12 9v6" />
    </>
  ),
  "pen-line": <path d="M12 20h9M4 20v-3.5L15.5 5 19 8.5 7.5 20H4Z" />,
  handshake: (
    <path d="m2 9 4-4 3 1.5h3L9 9.5a1.6 1.6 0 0 0 2.2 2.3L14 9.5l6 5.5M22 9l-4-4-3 1.5M20 15l-1.5 1.5M6 5v9l5 5 1.5-1.5M14 18l2 2 2.5-2.5M2 9v5h4" />
  ),
  "badge-percent": (
    <path d="m12 3 2.2 1.6 2.7-.2.9 2.6L20 8.6l-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.2L12 21l-2.2-1.6-2.7.2-.9-2.6L4 15.4l.8-2.6L4 10.2 6.2 8.6 7.1 6l2.7.2L12 3Zm-3 12 6-6m-5.5.5h.01m5 5h.01" />
  ),
  "message-square": <path d="M3 4h18v13H8l-5 4V4Zm5 5h8m-8 4h5" />,
  "layout-dashboard": <path d="M3 3h8v10H3V3Zm10 0h8v6h-8V3Zm0 8h8v10h-8V11ZM3 15h8v6H3v-6Z" />,
  network: <path d="M9 3h6v5H9V3ZM3 16h6v5H3v-5Zm12 0h6v5h-6v-5ZM12 8v4m-6 4v-4h12v4" />,
  calendar: <path d="M3 5h18v16H3V5Zm0 5h18M8 3v4m8-4v4" />,
  "calendar-clock": (
    <>
      <path d="M11 21H3V5h18v5H3M8 3v4m8-4v4" />
      <circle cx="17" cy="17" r="4.25" />
      <path d="M17 15v2l1.5 1" />
    </>
  ),
  "git-branch": (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M6 3v12.5M18 8.5A9.5 9.5 0 0 1 8.5 18" />
    </>
  ),
  "list-ordered": (
    <path d="M10 6h11m-11 6h11m-11 6h11M4 4h1v4M3.5 8h2.5M3.5 14a1.25 1.25 0 0 1 2.5.5L3.5 19H6" />
  ),
  "list-checks": (
    <path d="M12 6h9m-9 6h9m-9 6h9M3 6l1.5 1.5L7.5 4.5M3 12l1.5 1.5 3-3M3 18l1.5 1.5 3-3" />
  ),
  briefcase: <path d="M3 7h18v13H3V7Zm5 0V4h8v3M3 12.5h18M10.5 12.5v2h3v-2" />,
  clipboard: <path d="M8 5H5v16h14V5h-3M8 3h8v4H8V3Zm1 9h6m-6 4h6" />,
  "clipboard-check": <path d="M8 5H5v16h14V5h-3M8 3h8v4H8V3Zm1 11 2 2 4-4" />,
  "folder-check": <path d="M3 5h6l2 2.5h10V20H3V5Zm6 8.5 2 2 4-4" />,
  "shield-question": (
    <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-2 7.5a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.5v.3m0 2.5v.01" />
  ),
  pill: (
    <path d="M4.6 12.6 12.6 4.6a4.6 4.6 0 0 1 6.8 6.8l-8 8a4.6 4.6 0 0 1-6.8-6.8ZM8.5 8.7l6.8 6.8" />
  ),
  map: <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5ZM9 4v13.5m6-11V20" />,
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export const iconNames = Object.keys(paths) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "children"> {
  name: IconName;
  /** Rendered size in px (square). */
  size?: 16 | 20 | 24 | 32;
  /**
   * Accessible name. Omit for decorative icons (the default), which are hidden from assistive
   * technology; provide it only when the icon carries meaning that no adjacent text does.
   */
  title?: string;
}

export function Icon({ name, size = 20, title, ...props }: IconProps) {
  const a11y = title
    ? ({ role: "img", "aria-label": title } as const)
    : ({ "aria-hidden": true, focusable: false } as const);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      {...a11y}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
