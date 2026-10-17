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
  sector?: string;
  /** The "At a glance" row under the snapshot: short facts, each verified. */
  facts?: readonly ProductFact[];
  /** Body sections after the facts, in order: each a headed band. */
  sections?: readonly ProductSection[];
  /** Further captures of the product's site, each the `products.{slug}.{key}` image slot. */
  screens?: readonly ProductScreen[];
}

export interface ProductFact {
  label: string;
  value: string;
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

export interface ProductScreen {
  /** The slot key: the image is the `products.{slug}.{key}` slot. */
  key: string;
  /** What the capture shows, nothing more. */
  caption: string;
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
    snapshotCaption: "The Fauward dashboard as fauward.com shows it, with sample data.",
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
  // repository and the live site, 17 Oct 2026). No outcome figures: none are evidenced.
  {
    slug: "sob-autofix",
    name: "SOB Autofix",
    navLabel: "SOB Autofix — workshop platform",
    navDescription: "Built and operated by Vitalos",
    summary:
      "A booking and operations platform for a diagnostics-led vehicle workshop, built and operated by Vitalos.",
    description:
      "SOB Autofix is a booking and operations platform for a diagnostics-led vehicle workshop in Doncaster, built and operated by Vitalos and live at sobautofix.com.",
    url: "https://sobautofix.com",
    urlLabel: "Open sobautofix.com",
    viewLabel: "View SOB Autofix",
    snapshotCaption:
      "Step 1 of 7 of the booking flow on sobautofix.com: the vehicle comes first, by GB registration lookup or by hand, and the registration stays out of page addresses and analytics.",
    applicationCategory: "BusinessApplication",
    seo: {
      title: "SOB Autofix: Workshop Booking and Operations",
      description:
        "SOB Autofix is the vehicle-first booking and operations platform Vitalos built and runs for a diagnostics-led vehicle workshop in Doncaster.",
    },
    sector: "Automotive services",
    facts: [
      { label: "Live at", value: "sobautofix.com" },
      { label: "Sector", value: "Automotive services: an independent workshop in Doncaster" },
      {
        label: "Scope",
        value:
          "Booking engine · Quote flow · Content and local SEO · Privacy and consent · Staff admin",
      },
      {
        label: "Stack",
        value: "Next.js, React, Supabase, Vercel, Cloudflare Workers, Cal.com, Resend, Sentry",
      },
      { label: "Live since", value: "August 2026" },
    ],
    sections: [
      {
        heading: "The problem",
        intro:
          "SOB Autofix sells evidence-based diagnostics: test first, then replace parts. Its front door had to work the same way. Capture the vehicle and the symptom before offering a time, let customers change a booking without creating an account, and run on a small team's budget.",
      },
      {
        heading: "What it does",
        points: [
          {
            title: "Vehicle-first booking",
            text: "Seven steps: vehicle, service, problem, location, details, appointment and review. A GB registration lookup fills in the vehicle, with manual entry when the lookup is unavailable. Customers book as guests, with no account.",
          },
          {
            title: "Live appointment times",
            text: "Times come from the workshop's calendar through Cal.com, fetched on the server. Each service is set up for the workshop, for mobile visits, or for both.",
          },
          {
            title: "Manage Booking",
            text: "Customers find a booking with its reference and registration, then reschedule or cancel it through short-lived, signed access.",
          },
          {
            title: "Get a Quote",
            text: "A quote request that also starts with the vehicle, then the problem.",
          },
          {
            title: "Services and local content",
            text: "Fourteen service pages across diagnostics, repairs and mobile work, a Doncaster service-area page, news and advice with an RSS feed, and cars-for-sale listings.",
          },
          {
            title: "Staff operations",
            text: "One admin for bookings, enquiries with their email threads, stock, reviews, content and invoices; staff can secure sign-in with two-factor authentication. WhatsApp and click-to-call sit on every public page.",
          },
        ],
      },
      {
        heading: "Engineering decisions",
        points: [
          {
            title: "Registrations stay private",
            text: "A registration identifies a vehicle and often its owner. Lookups send it in the request body, the browser session holds the vehicle, and analytics strips it before sending, so it stays out of page addresses and analytics.",
          },
          {
            title: "Consent before optional storage",
            text: "The site runs on essential storage alone. Analytics and live chat load only after the visitor allows them; choosing essential only leaves both off.",
          },
          {
            title: "Times re-checked at submit",
            text: "Availability can change while a customer types. The server checks the chosen time with the calendar again before confirming: a taken time sends the customer back to choose another, and a repeated submission cannot create a second booking.",
          },
          {
            title: "Budgets enforced in CI",
            text: "Every change runs Lighthouse budgets (performance 90 or more, accessibility 95 or more, LCP within 2.5 seconds, CLS 0.1 or less) and axe checks on the booking flow and key pages.",
          },
          {
            title: "Structured, staff-edited content",
            text: "Services and pages are structured content that staff edit in the admin, with revisions, and the booking flow reads its choices from the same service catalogue. A content test fails the build if a service the workshop does not offer appears.",
          },
        ],
      },
      {
        heading: "Outcome",
        intro:
          "Live at sobautofix.com since August 2026. Customers book, request quotes and change their bookings online without an account; the workshop runs bookings, enquiries, content, stock and invoicing from one admin.",
      },
    ],
    screens: [
      {
        key: "home",
        caption:
          "The sobautofix.com homepage: the registration lookup sits in the first screen, beside the call to book.",
      },
      {
        key: "quote",
        caption: "Get a Quote: the request starts with the vehicle, then the problem.",
      },
    ],
  },
];

export const productBySlug = (slug: string): ProductView | undefined =>
  products.find((product) => product.slug === slug);

export const productPath = (product: Pick<ProductView, "slug">): string =>
  routes.product(product.slug);
