import type { Metadata } from "next";
import { brandName, ctas, filterNavByGates, navLabels, routes } from "@vitalos/cms";
import type { NavItem, PublicationGates } from "@vitalos/cms";
import { getFeatures } from "@vitalos/config";
import { Button, Container, FeatureGrid, PageHero, Section } from "@vitalos/ui";
import type { IconName } from "@vitalos/ui";
import { heroPhotograph } from "../../lib/view-mapping/hero-images";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { ClosingBand } from "../../templates/commercial/bands";
import { AskRelayButton } from "../ask-relay";
import { loadChromeContent } from "./load";

/** The 404's `<title>` (finding B12): "Page not found | Vitalos". Next.js adds `noindex` itself. */
export const notFoundTitle = `Page not found | ${brandName}`;

export const notFoundMetadata: Metadata = { title: { absolute: notFoundTitle } };

/** Structural labels of the 404 (no marketing copy). */
export const notFoundLabels = {
  routesHeading: "Where to go instead",
  askRelay: "Ask Relay where to find it",
} as const;

/** The main routes a lost visitor most likely wanted, in navigation order; gated ones when open. */
const mainRoutes: readonly (NavItem & { icon: IconName })[] = [
  { key: "what-we-do", label: navLabels.whatWeDo, href: routes.whatWeDo(), icon: "layers" },
  {
    key: "solutions",
    label: structuralLabels.solutions,
    href: routes.solutions(),
    icon: "workflow",
  },
  { key: "offers", label: structuralLabels.offers, href: routes.offers(), icon: "document" },
  {
    key: "industries",
    label: navLabels.industries,
    href: routes.industries(),
    gate: "industries",
    icon: "building",
  },
  { key: "labs", label: navLabels.labs, href: routes.labs(), gate: "labs", icon: "flask" },
  {
    key: "insights",
    label: navLabels.insights,
    href: routes.insights(),
    gate: "insights",
    icon: "search",
  },
  { key: "about", label: navLabels.about, href: routes.about(), icon: "building" },
  { key: "how-we-work", label: navLabels.howWeWork, href: routes.howWeWork(), icon: "workflow" },
  { key: "trust", label: navLabels.trustCentre, href: routes.trust(), icon: "shield" },
  { key: "faq", label: navLabels.faq, href: routes.faq(), icon: "info" },
  { key: "contact", label: navLabels.contact, href: routes.contact(), icon: "mail" },
];

export function notFoundRoutes(gates: PublicationGates) {
  const shown = new Set(filterNavByGates(mainRoutes, gates).map((item) => item.key));
  return mainRoutes.filter((item) => shown.has(item.key));
}

/**
 * The 404 body, on the compact dark hero of every page (pages redesign, 15 Oct 2026). The text
 * states a fact and offers routes that exist: the contact page (locked CTA copy), the home page,
 * the main sections (gated ones only while open) and, where Relay is on, the assistant.
 */
export async function NotFoundContent() {
  const { gates } = await loadChromeContent();
  const links = notFoundRoutes(gates);
  return (
    <main id="main" tabIndex={-1}>
      <PageHero
        tone="dark"
        size="title"
        backdrop={heroPhotograph}
        title="Page not found"
        lead="This page does not exist or is no longer available."
        actions={
          <>
            <Button href={routes.contact()} variant="secondary" size="lg" arrow>
              {ctas.primary}
            </Button>
            <Button variant="text" href={routes.home()}>
              Go to the homepage
            </Button>
          </>
        }
      />
      <Section tone="light" spacing="default" aria-labelledby="not-found-routes">
        <Container size="wide">
          <h2 id="not-found-routes" className="m-0 text-h2 text-balance text-tone-heading">
            {notFoundLabels.routesHeading}
          </h2>
          <FeatureGrid
            className="mt-(--space-7)"
            columns={4}
            items={links.map((item) => ({ title: item.label, href: item.href, icon: item.icon }))}
          />
          {getFeatures().relay ? (
            <p className="m-0 mt-(--space-6)">
              <AskRelayButton label={notFoundLabels.askRelay} />
            </p>
          ) : null}
        </Container>
      </Section>
      <ClosingBand />
    </main>
  );
}
