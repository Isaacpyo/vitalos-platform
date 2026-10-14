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
