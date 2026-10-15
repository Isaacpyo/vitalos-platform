import type { IconName } from "../../primitives/Icon";
import type { PatternLink } from "../_internal/types";

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
  /** A subject icon on a small tile beside the link in a mega-menu column (decorative). */
  icon?: IconName | undefined;
}

/** One column of a mega-menu panel (for example Practices, Solutions, Popular Offers). */
export interface MegaMenuColumn {
  key: string;
  heading: string;
  /** Section index for the column, when it has one. The heading becomes a link. */
  href?: string | undefined;
  links: readonly SiteNavLink[];
  /** A closing "view all" link under the column's links. */
  more?: PatternLink | undefined;
}

/** The highlighted card at the end of a mega-menu panel, on the dark tone. */
export interface MegaMenuFeature {
  eyebrow?: string | undefined;
  title: string;
  text?: string | undefined;
  /** An ordered sequence shown as ticked steps, for example the AI journey. */
  steps?: readonly string[] | undefined;
  /** The card's actions: the first is a button, any others quiet links. */
  links: readonly PatternLink[];
}

export interface SiteNavMenu {
  /** Columns without links are omitted. */
  columns: readonly MegaMenuColumn[];
  /**
   * `columns` (default): the full-width mega-menu panel. `list`: a compact dropdown under the
   * label with the links of every column in one list (headings are not shown), for a short menu.
   */
  layout?: "columns" | "list" | undefined;
  /** A highlighted card beside the columns (`columns` layout, from lg). */
  feature?: MegaMenuFeature | undefined;
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
