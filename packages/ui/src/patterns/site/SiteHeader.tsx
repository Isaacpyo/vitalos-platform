import { Button } from "../../primitives/Button";
import { Container } from "../../primitives/Container";
import { Wordmark, type WordmarkLogo } from "../../primitives/Wordmark";
import type { PatternLink } from "../_internal/types";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";
import { StickyHeader } from "./StickyHeader";
import { topLevelLinkClasses, utilityLinkClasses } from "./nav-styles";
import type { SiteNavItem, SiteNavLink } from "./types";

export interface SiteHeaderProps {
  /** Primary navigation, already filtered by publication gates. */
  items: readonly SiteNavItem[];
  /** Lower-emphasis utility links (the Trust Centre). In the bar from lg; in MobileNav below it. */
  utility?: readonly SiteNavLink[] | undefined;
  /** The primary action. In the bar at every width (beside the menu trigger on compact screens). */
  cta?: PatternLink | undefined;
  /** Key of the current section: underlined, bold and `aria-current` (never colour alone). */
  activeSection?: string | undefined;
  /** Where the wordmark links. */
  homeHref?: string | undefined;
  /** Approved logo export; omitted until the production SVG exists (text fallback renders). */
  logo?: WordmarkLogo | undefined;
  wordmarkText?: string | undefined;
  /** Visible label of the compact menu trigger. */
  menuLabel?: string | undefined;
  /** Accessible names of the two navigation landmarks. */
  navLabel?: string | undefined;
  /** Render the scrolled (condensed) state on first paint (Storybook, documentation). */
  defaultCondensed?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Sticky site header: wordmark, primary links (What We Do opens a MegaMenu island), the utility
 * link and the primary action; below lg the links move into MobileNav (a sheet), while the
 * primary action stays in the bar at every width. A hairline always separates the bar from the
 * content; once the page scrolls the bar condenses and blurs what passes beneath (StickyHeader,
 * no layout shift). Every label comes from props.
 */
export function SiteHeader({
  items,
  utility,
  cta,
  activeSection,
  homeHref = "/",
  logo,
  wordmarkText,
  menuLabel,
  navLabel = "Primary",
  defaultCondensed,
  className,
}: SiteHeaderProps) {
  return (
    <StickyHeader className={className} defaultCondensed={defaultCondensed}>
      <Container size="wide">
        <div className="flex h-(--header-h) items-center gap-(--space-3) transition-[height] duration-(--duration-reveal) ease-(--ease-standard) sm:gap-(--space-4) lg:gap-(--space-5)">
          <Wordmark
            href={homeHref}
            {...(logo ? { logo } : {})}
            {...(wordmarkText ? { text: wordmarkText } : {})}
            className="shrink-0"
          />
          <nav aria-label={navLabel} className="hidden h-full min-w-0 flex-1 lg:block">
            <ul className="m-0 flex h-full list-none items-center justify-center gap-x-(--space-1) p-0 xl:gap-x-(--space-2)">
              {items.map((item) =>
                item.menu ? (
                  <MegaMenu
                    key={item.key}
                    id={`site-nav-${item.key}`}
                    label={item.label}
                    href={item.href}
                    columns={item.menu.columns}
                    active={item.key === activeSection}
                    toggleLabel={item.menu.toggleLabel}
                  />
                ) : (
                  <li key={item.key} className="flex items-center self-stretch">
                    <a
                      href={item.href}
                      {...(item.key === activeSection ? { "aria-current": "true" as const } : {})}
                      className={topLevelLinkClasses(item.key === activeSection)}
                    >
                      {item.label}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-(--space-2) sm:gap-(--space-3) lg:ml-0">
            {utility && utility.length > 0 ? (
              <ul className="m-0 hidden list-none gap-(--space-4) p-0 lg:flex">
                {utility.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className={utilityLinkClasses}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {cta ? (
              <div className="hidden lg:block">
                <Button href={cta.href} size="sm" arrow>
                  {cta.label}
                </Button>
              </div>
            ) : null}
            <div className="lg:hidden">
              <MobileNav
                items={items}
                utility={utility}
                cta={cta}
                menuLabel={menuLabel}
                aria-label={navLabel}
                activeKey={activeSection}
              />
            </div>
          </div>
        </div>
      </Container>
    </StickyHeader>
  );
}
