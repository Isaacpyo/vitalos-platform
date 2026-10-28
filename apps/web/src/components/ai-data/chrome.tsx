import type { ReactNode } from "react";
import { routes } from "@vitalos/cms";
import type { LegalSlug } from "@vitalos/cms";
import { Button, Container, Icon } from "@vitalos/ui";
import { getContentSource } from "../../lib/cms/get-content-source";
import { whiteLogo } from "../site-chrome/nav-model";
import { division, navItems } from "../../features/ai-data/copy";

/**
 * Chrome for the Vitalos AI & Data section (AID-002): its own header and footer, not the main
 * site shell. Server components only; the mobile menu is a native `<details>` disclosure, so it
 * opens and closes with the keyboard and without JavaScript.
 *
 * The wordmark is the site's own white VITALOS lockup (docs/brand/asset-approval.md), followed by
 * a thin divider and the smaller "AI & DATA" qualifier (blueprint 3.4).
 */

export type AiDataSection = "home" | "solutions" | "approach" | "demonstrator" | "contact";

const sectionHref: Record<Exclude<AiDataSection, "home">, string> = {
  solutions: routes.aiData.solutions(),
  approach: routes.aiData.approach(),
  demonstrator: routes.aiData.demonstrator(),
  contact: routes.aiData.contact(),
};

function Lockup() {
  return (
    <a
      href={routes.aiData.home()}
      className="flex min-h-11 shrink-0 items-center gap-(--space-3) no-underline"
    >
      <img
        src={whiteLogo.src}
        width={whiteLogo.width}
        height={whiteLogo.height}
        alt="Vitalos"
        className="block h-5 w-auto sm:h-6"
      />
      <span aria-hidden="true" className="block h-5 w-px bg-aid-line" />
      <span className="text-small font-semibold tracking-[0.16em] text-aid-muted uppercase">
        {division.qualifier}
      </span>
    </a>
  );
}

const linkClasses =
  "inline-flex min-h-11 items-center px-(--space-1) text-body text-aid-muted no-underline hover:text-aid-heading aria-[current=page]:text-aid-heading aria-[current=page]:underline aria-[current=page]:decoration-aid-accent aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8";

export function AiDataHeader({ current }: Readonly<{ current: AiDataSection }>) {
  const isCurrent = (href: string) =>
    current !== "home" && sectionHref[current] === href ? ("page" as const) : undefined;
  return (
    <header data-aid-tone="dark" className="relative z-20 border-b border-aid-border bg-aid-bg">
      <Container
        size="content"
        className="flex min-h-16 items-center justify-between gap-(--space-4)"
      >
        <Lockup />
        <nav aria-label="Vitalos AI & Data" className="hidden items-center gap-(--space-6) lg:flex">
          <ul className="m-0 flex list-none items-center gap-(--space-5) p-0">
            {navItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} aria-current={isCurrent(item.href)} className={linkClasses}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <Button href={routes.aiData.contact()} size="sm">
            {division.headerCta}
          </Button>
        </nav>
        <details className="group lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-(--space-2) rounded-md border border-aid-line px-(--space-3) text-small font-semibold text-aid-heading [&::-webkit-details-marker]:hidden">
            <Icon name="menu" size={20} className="group-open:hidden" />
            <Icon name="close" size={20} className="hidden group-open:block" />
            <span>Menu</span>
          </summary>
          <nav
            aria-label="Vitalos AI & Data"
            className="absolute inset-x-0 top-full border-b border-aid-line bg-aid-bg shadow-floating"
          >
            <Container size="content" className="pt-(--space-2) pb-(--space-6)">
              <ul className="m-0 flex list-none flex-col p-0">
                {navItems.map((item) => (
                  <li key={item.href} className="border-b border-aid-border">
                    <a
                      href={item.href}
                      aria-current={isCurrent(item.href)}
                      className={`${linkClasses} w-full py-(--space-2) text-body-l`}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="pt-(--space-5)">
                <Button href={routes.aiData.contact()} className="w-full">
                  {division.headerCta}
                </Button>
              </div>
            </Container>
          </nav>
        </details>
      </Container>
    </header>
  );
}

const footerLegal: readonly { slug: LegalSlug; label: string }[] = [
  { slug: "privacy", label: "Privacy" },
  { slug: "terms", label: "Terms" },
  { slug: "accessibility", label: "Accessibility" },
];

/**
 * Footer: back to the main site, the legal pages that exist, the Trust Centre, and the legal
 * identity from site settings. No link is shown for a page the content source does not have.
 */
export async function AiDataFooter() {
  const source = await getContentSource();
  const [chrome, ...legal] = await Promise.all([
    source.getSiteChrome(),
    ...footerLegal.map((item) => source.getDocument("legalPage", item.slug)),
  ]);
  const legalLinks = footerLegal.filter((_, index) => legal[index] !== null);
  const { legalName, companyNumber } = chrome.settings;
  const links: { label: string; href: string }[] = [
    ...legalLinks.slice(0, 2).map((item) => ({ label: item.label, href: routes.legal(item.slug) })),
    { label: "Trust Centre", href: routes.trust() },
    ...legalLinks.slice(2).map((item) => ({ label: item.label, href: routes.legal(item.slug) })),
  ];
  return (
    <footer data-aid-tone="dark" className="border-t border-aid-border bg-aid-bg">
      <Container size="content" className="flex flex-col gap-(--space-7) py-(--space-8)">
        <div className="flex flex-col justify-between gap-(--space-6) md:flex-row md:items-start">
          <div className="flex max-w-md flex-col gap-(--space-4)">
            <Lockup />
            <p className="m-0 text-small text-aid-muted">
              {division.category}. We help UK businesses turn specific operational problems into
              working, measured systems.
            </p>
          </div>
          <div className="flex flex-col gap-(--space-3)">
            <p className="m-0 text-small font-semibold text-aid-heading">Part of Vitalos</p>
            <a
              href={routes.home()}
              className="inline-flex min-h-11 items-center gap-(--space-2) text-small text-aid-link underline underline-offset-4 hover:text-aid-link-hover"
            >
              Visit vitalos.co.uk
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-(--space-4) border-t border-aid-border pt-(--space-5) md:flex-row md:items-center md:justify-between">
          <nav aria-label="Legal and trust">
            <ul className="m-0 flex list-none flex-wrap gap-x-(--space-5) gap-y-(--space-1) p-0">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-small text-aid-muted underline-offset-4 hover:text-aid-heading hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {legalName ? (
            <p className="m-0 text-small text-aid-muted">
              © {new Date().getFullYear()} {legalName}
              {companyNumber ? <>. Company number {companyNumber}</> : null}
            </p>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}

/** Header, the page's own `<main id="main">`, footer. */
export function AiDataPage({
  current,
  children,
}: Readonly<{ current: AiDataSection; children: ReactNode }>) {
  return (
    <>
      <AiDataHeader current={current} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <AiDataFooter />
    </>
  );
}
