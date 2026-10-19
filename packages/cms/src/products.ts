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
  /** The sector, after "Products" in the page's eyebrow. */
  sector: string;
  /**
   * The body bands after the snapshot, in the product page template's order
   * (docs/content/PRODUCT-PAGE-TEMPLATE.md): "What it does" (cards), "How it works" (steps) and
   * "Built for" (tiles). `products.test.ts` holds every product to that shape.
   */
  sections: readonly ProductSection[];
}

/**
 * A headed band: an introduction, then optional headed points. `layout` sets how the points show:
 * `points` (default) as headed paragraphs between hairlines; `cards` as icon cards; `steps` as a
 * numbered sequence; `tiles` as a row of short icon cards. Cards, steps and tiles suit short
 * points (a title of four words or fewer and a line of ten).
 */
export interface ProductSection {
  heading: string;
  intro?: string;
  layout?: "points" | "cards" | "steps" | "tiles";
  points?: readonly ProductPoint[];
}

/** One point of a section. `key` is stable: the web app picks the point's icon by it. */
export interface ProductPoint {
  key?: string;
  title: string;
  text: string;
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
      "The Fauward tenant portal: dashboard, finance and Fauward Go, with sample data.",
    applicationCategory: "BusinessApplication",
    seo: {
      title: "Fauward: Logistics SaaS Platform",
      description:
        "Fauward is the white-label logistics platform Vitalos builds and operates: shipments, branded tracking, a field app, invoicing and an operations agent.",
    },
    sector: "Logistics",
    // From fauward.com (17 Oct 2026): its services, its eight-step shipment workflow (in four
    // steps here) and the businesses it names. No prices, uptime or speed figures.
    sections: [
      {
        heading: "What it does",
        layout: "cards",
        points: [
          {
            key: "shipments",
            title: "Shipment operations",
            text: "Booking to proof of delivery, in one lifecycle.",
          },
          {
            key: "white-label",
            title: "White-label portal",
            text: "Your domain, colours and logo. Tracking with no login.",
          },
          {
            key: "field-app",
            title: "Fauward Go",
            text: "Offline-first field app: QR scans, photos, signatures.",
          },
          {
            key: "finance",
            title: "Finance & invoicing",
            text: "Invoices raised on delivery, payments reconciled.",
          },
          {
            key: "agent",
            title: "Fauward Agent",
            text: "Flags SLA risks and suggests actions. Dispatchers approve.",
          },
          {
            key: "api",
            title: "API & integrations",
            text: "REST API, webhooks and carrier integrations.",
          },
        ],
      },
      {
        heading: "How it works",
        layout: "steps",
        points: [
          { title: "Book and assign", text: "Each booking goes to an operator." },
          { title: "Collect and track", text: "Live GPS. Customers kept updated." },
          { title: "Deliver with proof", text: "Photo, signature or one-time code." },
          { title: "Invoice and reconcile", text: "Invoiced on delivery, then paid." },
        ],
      },
      {
        heading: "Built for",
        layout: "tiles",
        points: [
          { key: "courier", title: "Courier start-ups", text: "Launch under your own brand." },
          { key: "freight", title: "Freight operators", text: "Many depots, one source of truth." },
          { key: "3pl", title: "3PL providers", text: "A branded portal for each client." },
          { key: "enterprise", title: "Enterprise fleets", text: "SSO, audit logs and support." },
        ],
      },
    ],
  },
  // Every claim maps to a line in docs/content/DISCOVERY-sob-autofix.md (the SOB Autofix
  // repository and the live site, 17 Oct 2026): its booking flow (seven steps, in four here),
  // its other systems and the people it serves. No outcome figures: none are evidenced.
  {
    slug: "sob-autofix",
    name: "SOB Autofix",
    navLabel: "SOB Autofix — workshop platform",
    navDescription: "Built and operated by Vitalos",
    summary:
      "A booking and operations platform for a diagnostics-led vehicle workshop, built and operated by Vitalos.",
    description:
      "Vitalos builds and operates SOB Autofix, a booking and operations platform for a diagnostics-led vehicle workshop in Doncaster.",
    url: "https://sobautofix.com",
    urlLabel: "Open sobautofix.com",
    viewLabel: "View SOB Autofix",
    snapshotCaption: "Step 1 of 7 of the SOB Autofix booking flow, as sobautofix.com shows it.",
    applicationCategory: "BusinessApplication",
    seo: {
      title: "SOB Autofix: Workshop Booking and Operations",
      description:
        "SOB Autofix is the vehicle-first booking and operations platform Vitalos built and runs for a diagnostics-led vehicle workshop in Doncaster.",
    },
    sector: "Automotive services",
    sections: [
      {
        heading: "What it does",
        layout: "cards",
        points: [
          {
            key: "booking",
            title: "Vehicle-first booking",
            text: "Seven steps from registration lookup. No account needed.",
          },
          {
            key: "times",
            title: "Live appointment times",
            text: "From the workshop calendar, re-checked before confirming.",
          },
          {
            key: "manage",
            title: "Manage Booking",
            text: "Reschedule or cancel with reference and registration.",
          },
          {
            key: "quote",
            title: "Get a Quote",
            text: "Quote requests that start with the vehicle.",
          },
          {
            key: "privacy",
            title: "Private by design",
            text: "Registrations kept out of page addresses and analytics.",
          },
          {
            key: "admin",
            title: "Workshop admin",
            text: "Bookings, enquiries, content, stock and invoices together.",
          },
        ],
      },
      {
        heading: "How it works",
        layout: "steps",
        points: [
          { title: "Vehicle first", text: "Registration lookup, or the details by hand." },
          { title: "Work and symptoms", text: "Choose the service, describe the problem." },
          { title: "Place and time", text: "Workshop or mobile, then a live slot." },
          { title: "Review and confirm", text: "Book as a guest; manage it later." },
        ],
      },
      {
        heading: "Built for",
        layout: "tiles",
        points: [
          { key: "drivers", title: "Drivers", text: "Book a diagnosis without an account." },
          { key: "mobile", title: "Mobile visits", text: "Where the service allows it." },
          { key: "car-buyers", title: "Car buyers", text: "Cars for sale, with enquiries." },
          { key: "workshop", title: "Workshop staff", text: "One admin, with two-factor sign-in." },
        ],
      },
    ],
  },
];

export const productBySlug = (slug: string): ProductView | undefined =>
  products.find((product) => product.slug === slug);

export const productPath = (product: Pick<ProductView, "slug">): string =>
  routes.product(product.slug);
