import type { Meta, StoryObj } from "@storybook/react-vite";
import { MegaMenu, MobileNav, SiteFooter, SiteHeader, TerminalCTA } from "@vitalos/ui";
import { Frame } from "../primitives/_frame";
import { cta, navItems, text, url, utilityLinks } from "./_fixtures";

const meta = {
  title: "Patterns/Site",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/* ---------- Header ---------- */

export const Header: Story = {
  render: () => (
    <SiteHeader items={navItems} utility={utilityLinks} cta={cta} activeSection="section-two" />
  ),
};

export const HeaderCondensed: Story = {
  name: "Header (condensed after scroll, backdrop blur)",
  render: () => (
    <div className="bg-tone-bg">
      <SiteHeader
        items={navItems}
        utility={utilityLinks}
        cta={cta}
        activeSection="section-two"
        defaultCondensed
      />
      <p className="px-4 py-6 text-body text-tone-text">{text.summary}</p>
    </div>
  ),
};

export const HeaderScrolling: Story = {
  name: "Header (scroll the page: condenses with no layout shift)",
  render: () => (
    <div className="min-h-[300vh]">
      <SiteHeader items={navItems} utility={utilityLinks} cta={cta} />
      {[1, 2, 3].map((n) => (
        <p key={n} className="px-4 py-12 text-body text-tone-text">
          {text.summary}
        </p>
      ))}
    </div>
  ),
};

export const HeaderMinimal: Story = {
  name: "Header (no items, no action)",
  render: () => <SiteHeader items={[]} wordmarkText="EXAMPLE (fixture)" />,
};

export const HeaderLongerLabels: Story = {
  name: "Header (longer labels)",
  render: () => (
    <SiteHeader
      items={[
        { key: "a", label: "Example longer label (fixture)", href: url("a") },
        { key: "b", label: "Example another longer label (fixture)", href: url("b") },
      ]}
      cta={{ label: "Example longer action label (fixture)", href: url("contact") }}
    />
  ),
};

/* ---------- Mega-menu ---------- */

export const MegaMenuOpen: Story = {
  name: "Mega-menu (open)",
  render: () => (
    <div className="relative min-h-96">
      <header className="relative border-b border-tone-border bg-tone-bg">
        <nav
          aria-label="Example primary (fixture)"
          className="mx-auto max-w-(--container-max) px-4"
        >
          <ul className="m-0 flex h-(--size-header) list-none items-center p-0">
            <MegaMenu
              label="Example section one (fixture)"
              href={url("section-one")}
              columns={navItems[0]?.menu?.columns ?? []}
              active
              defaultOpen
              id="story-mega"
            />
          </ul>
        </nav>
      </header>
    </div>
  ),
};

export const MegaMenuClosed: Story = {
  name: "Mega-menu (closed, active)",
  render: () => (
    <nav aria-label="Example primary (fixture)" className="px-4">
      <ul className="m-0 flex h-(--size-header) list-none items-center p-0">
        <MegaMenu
          label="Example section one (fixture)"
          href={url("section-one")}
          columns={navItems[0]?.menu?.columns ?? []}
          active
          id="story-mega-closed"
        />
      </ul>
    </nav>
  ),
};

/* ---------- Mobile nav ---------- */

export const MobileNavClosed: Story = {
  name: "Mobile nav (closed)",
  render: () => (
    <header className="relative border-b border-tone-border bg-tone-bg px-4 py-3">
      <MobileNav items={navItems} utility={utilityLinks} cta={cta} />
    </header>
  ),
};

export const MobileNavOpen: Story = {
  name: "Mobile nav (open sheet; two columns from md)",
  render: () => (
    <div className="relative min-h-[40rem]">
      <header className="relative border-b border-tone-border bg-tone-bg px-4 py-3">
        <MobileNav
          items={navItems}
          utility={utilityLinks}
          cta={cta}
          activeKey="section-two"
          defaultOpen
        />
      </header>
    </div>
  ),
};

/* ---------- Footer ---------- */

const columns = [
  {
    key: "what",
    heading: "Example column one (fixture)",
    links: [1, 2, 3, 4, 5].map((n) => ({
      label: `Example link ${n} (fixture)`,
      href: url(`f${n}`),
    })),
  },
  {
    key: "explore",
    heading: "Example column two (fixture)",
    links: [{ label: "Example link (fixture)", href: url("explore") }],
  },
  {
    key: "company",
    heading: "Example column three (fixture)",
    links: [
      { label: text.longTitle, href: url("long") },
      { label: text.longWord, href: url("word") },
    ],
  },
  { key: "empty", heading: "Example empty column (fixture)", links: [] },
];

export const Footer: Story = {
  render: () => (
    <SiteFooter
      brand={{
        wordmarkText: "EXAMPLE (fixture)",
        descriptor: "Example descriptor (fixture)",
        proposition: "Example proposition (fixture). Placeholder text, not product copy.",
        homeHref: url(""),
      }}
      columns={columns}
      contact={{
        heading: "Example contact (fixture)",
        email: "hello@example.invalid",
        social: [{ label: "Example social (fixture)", href: url("social") }],
      }}
      legalIdentity={{
        heading: "Example identity (fixture)",
        lines: ["Example company name (fixture)", "Example registration details (fixture)"],
      }}
    />
  ),
};

export const FooterSparse: Story = {
  name: "Footer (sparse: empty columns omitted)",
  render: () => (
    <SiteFooter
      brand={{ wordmarkText: "EXAMPLE (fixture)" }}
      columns={[columns[1]!, columns[3]!]}
    />
  ),
};

export const FooterBare: Story = {
  name: "Footer (no data)",
  render: () => <SiteFooter columns={[]} />,
};

/* ---------- Terminal CTA ---------- */

export const TerminalCtaDark: Story = {
  name: "Terminal CTA (midnight)",
  render: () => (
    <TerminalCTA
      heading="Example closing heading (fixture)"
      body="Example supporting line (fixture)."
      primary={cta}
      secondary={{ label: "Example secondary (fixture)", href: url("secondary") }}
    />
  ),
};

export const TerminalCtaLightLong: Story = {
  name: "Terminal CTA (light, long)",
  render: () => (
    <TerminalCTA
      tone="light"
      heading={text.longTitle}
      body={text.summary}
      primary={{ label: text.longTitle, href: url("contact") }}
    />
  ),
};

export const TerminalCta320: Story = {
  name: "Terminal CTA (320px)",
  render: () => (
    <Frame tone="dark" width={320}>
      <TerminalCTA
        heading={text.longTitle}
        primary={cta}
        secondary={{ label: "Example secondary (fixture)", href: url("s") }}
      />
    </Frame>
  ),
};
