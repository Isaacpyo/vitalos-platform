import type { ReactNode } from "react";
import { Icon, IconFrame, type IconName, type IconProps } from "../primitives/Icon";
import { IconTileFrame, iconTileGlyphSize, type IconTileProps } from "../primitives/IconTile";

/**
 * Subject icons for the points of lead and offer pages (Website Build Pack, 25 Oct 2026): the
 * same 24px grid, 1.5px stroke and square caps as the core set (`Icon`), kept in their own entry
 * point so they never ship in client JavaScript. Only server components import
 * `@vitalos/ui/subject-icons`; the core set is imported by client islands (menus, forms), so every
 * glyph in it is paid for on every page (ADR-021 budgets). A name not drawn here falls back to the
 * core set, so a subject icon can be any core icon too.
 */
const subjectPaths = {
  // The Health & Care pages (first build).
  inbox: <path d="M3 13h5l1.5 3h5l1.5-3h5M3 13l3-8h12l3 8v7H3v-7Z" />,
  plug: <path d="M9 3v4m6-4v4M7 7h10v4a5 5 0 0 1-10 0V7Zm5 9v5" />,
  unplug: <path d="M9 3v4m6-4v4M7 7h10v4a5 5 0 0 1-10 0V7Zm5 9v5M3 3l18 18" />,
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
  // Revision 2 of the Health & Care pages.
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

export type SubjectIconName = IconName | keyof typeof subjectPaths;

export const subjectIconNames = Object.keys(subjectPaths) as (keyof typeof subjectPaths)[];

const isSubjectGlyph = (name: SubjectIconName): name is keyof typeof subjectPaths =>
  Object.hasOwn(subjectPaths, name);

export interface SubjectIconProps extends Omit<IconProps, "name"> {
  name: SubjectIconName;
}

/** A subject icon, decorative unless `title` is given (see `Icon`). */
export function SubjectIcon({ name, ...props }: SubjectIconProps) {
  return isSubjectGlyph(name) ? (
    <IconFrame {...props}>{subjectPaths[name]}</IconFrame>
  ) : (
    <Icon name={name} {...props} />
  );
}

export interface SubjectIconTileProps extends Omit<IconTileProps, "name"> {
  name: SubjectIconName;
}

/** A subject icon on the tinted tile (see `IconTile`). Decorative. */
export function SubjectIconTile({ name, size = "md", className }: SubjectIconTileProps) {
  return (
    <IconTileFrame size={size} className={className}>
      <SubjectIcon name={name} size={iconTileGlyphSize(size)} />
    </IconTileFrame>
  );
}
