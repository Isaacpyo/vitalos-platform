/**
 * Site chrome prop types. Structurally compatible with @vitalos/cms `NavItem` ({ key, label,
 * href }) so the web app can pass the gate-filtered navigation through unchanged.
 */

export interface SiteNavLink {
  key?: string | undefined;
  label: string;
  href: string;
  /** One quiet line under the link in a mega-menu column. */
  description?: string | undefined;
}

/** One column of a mega-menu panel (for example Practices, Solutions, Popular Offers). */
export interface MegaMenuColumn {
  key: string;
  heading: string;
  /** Section index for the column, when it has one. The heading becomes a link. */
  href?: string | undefined;
  links: readonly SiteNavLink[];
}

export interface SiteNavMenu {
  /** Columns without links are omitted. */
  columns: readonly MegaMenuColumn[];
  /** Accessible name of the disclosure button. Defaults to "<label> menu". */
  toggleLabel?: string | undefined;
}

export interface SiteNavItem {
  key: string;
  label: string;
  /** The section index. Always a real link, with or without a menu. */
  href: string;
  menu?: SiteNavMenu | undefined;
}
