/**
 * Products Vitalos builds and operates (owner direction, 17 Oct 2026). The single source for the
 * Products pages, the Who We Are menu, the footer, the About sentence, llms.txt and the
 * SoftwareApplication markup. Each product says only what its own site shows: no customer
 * numbers, features or prices.
 */
import { routes } from "./routes";

export interface ProductView {
  slug: string;
  /** The product's name: the h1 of its page and the title of its card. */
  name: string;
  /** Menu label: the name and what it is. */
  navLabel: string;
  /** One quiet line under the menu label. */
  navDescription: string;
  /** One line for the Products card. */
  summary: string;
  /** The one-sentence description: the About sentence and the lead of the product's page. */
  description: string;
  /** The product's own site (external, opened in the same tab). */
  url: string;
  /** Label of the action that opens the product's site. */
  urlLabel: string;
  /** Label of the card link to the product's page. */
  viewLabel: string;
  /** Caption of the snapshot on the product's page: what the image shows, nothing more. */
  snapshotCaption: string;
  /** schema.org `applicationCategory`. */
  applicationCategory: "BusinessApplication";
  seo: { title: string; description: string };
}

export const products: readonly ProductView[] = [
  {
    slug: "fauward",
    name: "Fauward",
    navLabel: "Fauward — logistics SaaS",
    navDescription: "Built and operated by Vitalos",
    summary: "A logistics SaaS platform, built and operated by Vitalos.",
    description: "Vitalos builds and operates Fauward, a logistics SaaS platform.",
    url: "https://fauward.com",
    urlLabel: "Open fauward.com",
    viewLabel: "View Fauward",
    snapshotCaption:
      "The Fauward dashboard as fauward.com shows it, with sample data: shipments today, active drivers, month-to-date revenue and SLA score; each shipment's status, driver and ETA; and a live feed of customer notifications, proofs of delivery and invoices.",
    applicationCategory: "BusinessApplication",
    seo: {
      title: "Fauward: Logistics SaaS Platform",
      description:
        "Fauward is the logistics SaaS platform Vitalos builds and operates. See a snapshot of its dashboard, then open fauward.com to find out more.",
    },
  },
];

export const productBySlug = (slug: string): ProductView | undefined =>
  products.find((product) => product.slug === slug);

export const productPath = (product: Pick<ProductView, "slug">): string =>
  routes.product(product.slug);
