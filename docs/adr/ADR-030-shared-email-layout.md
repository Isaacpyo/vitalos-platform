# ADR 030 Shared email layout for every Vitalos email

Status: Accepted (owner brief, 12 October 2026). Numbered 030 because ADR-029 is the Super Admin enquiries, mail and console ADR (PR #83).

## Context

The owner approved the redesigned internal enquiry notification (ADR-019, status note of 12 October 2026) and asked for every Vitalos email to use the same branding: the enquiry notification sent by the website (TypeScript, `apps/web`) and an email template library in the Super Admin (Python/Django, `superadmin/`, ADR-026). The two applications must not import each other's source (`AGENTS.md`, ADR-026), and the Super Admin container builds from the `superadmin/` directory only, so it cannot read `packages/` at build or run time.

## Decision

1. **One package owns the layout**: `@vitalos/email-layout` (`packages/email-layout`). It holds the markup of every email part as plain strings with `[[slot]]` placeholders (`snippets.ts`), the light and dark colour roles from `@vitalos/design-tokens` (`theme.ts`), the inline images (white logo and social icons, `images.ts` and `assets/`), the cleaning and escaping rules (`escape.ts`) and a renderer (`render.ts`) that turns a block document into HTML, plain text and the list of inline images.
2. **Blocks**: heading, section title, text (paragraphs and `- ` bullets, optional muted tone), button, badges, quote, details (label/value rows with optional link, note, sub-value, hint or copyable code), divider and signature. The footer is part of the layout: optional notice, social icons, legal name, company number, registered office, website and support address (placeholders when a fact is missing), and for marketing and outreach a reason-for-contact line with an unsubscribe link.
3. **The Super Admin renders from a generated copy.** The package tests write the layout as data (`superadmin/email-layout/email-layout.json`: snippets, theme, style blocks, images) and golden fixtures (`superadmin/email-layout/fixtures/*.input.json` with the expected `.html`, `.txt` and image list) using Vitest file snapshots. CI fails when the committed copy differs from what the package produces; regenerate with `vitest run -u` in `packages/email-layout`. The Super Admin's Python renderer mirrors `render.ts` and must reproduce the golden fixtures byte for byte.
4. **The enquiry notification is the first user.** `apps/web/src/features/enquiries/adapters/enquiry-notification-email.ts` now builds a block document; the markup, theme and images moved into the package. Its fields, order and sending are unchanged.
5. **Technical rules hold for every email**: table layout, inline styles, 600px single column, system fonts, no scripts, no remote images or fonts, no tracking; only `https:` and `mailto:` links are rendered (anything else is shown as text); every value is cleaned (control and bidi-override characters removed) and escaped; dark mode through `prefers-color-scheme` and Outlook.com's `data-ogsc`/`data-ogsb`; the header keeps its midnight fill under Gmail's forced inversion; WCAG AA contrast is tested for every text/background pair in both themes; and every email has a plain-text part with the same content in the same order.

## Options

- **Render every email in one application** (the website posting enquiries to the Super Admin to render and send): rejected; it would change how enquiries are delivered and add a dependency between the two services.
- **Two independent templates, kept in step by review**: rejected; they drift.
- **Share a template language both can run (for example Mustache) with logic in templates**: rejected; the conditional and repeated parts (rows, badges, footer variants) would still need code on both sides, so a small mirrored renderer with golden fixtures is simpler and testable.

## Consequences

- A layout change is made once, in the package, and reaches the Super Admin through the regenerated spec and fixtures in the same pull request.
- The Python renderer is a second implementation of `render.ts`; the golden fixtures are the contract. Add a fixture when a block or footer rule changes.
- The `superadmin/email-layout/` files are generated: never edit them by hand.

## Revisit triggers

A third application that sends email; a decision to merge the website and Super Admin palettes (`docs/brand/token-reconciliation.md`); a change of email provider that needs a different image strategy than CID attachments.

## Status note (12 October 2026): Super Admin side

The Super Admin now renders every email template with `superadmin/apps/mailer/layout.py`, which passes the golden fixtures byte for byte. The email template library (Mail > Email templates, SuperAdmin only) stores templates and versions in PostgreSQL, seeds the library templates (82 as of 27 Oct 2026) from `superadmin/apps/email_templates/seed/`, reads footer facts from Settings > Company and sends inline images as CID attachments (`superadmin/docs/DECISIONS.md` 78 to 88). A muted text block right under a heading keeps the 4px subtitle gap; any other text under a heading now has 12px.

## Status note (27 October 2026): new blocks and correspondence mode

The email audit (`docs/email/`) added four blocks and one mode, each in `render.ts` and `snippets.ts`, mirrored in `layout.py`, with golden fixtures (`new-blocks`, `correspondence`), AA tests and a plain-text form. They use only existing colour roles and dark classes; spec version 2.

- **`code`**: a verification code in 32px monospace as one text node without spaces (it copies cleanly), in a ruled code box, with an optional expiry line. The renderer refuses a document whose subject or preheader contains the code.
- **`steps`**: 1 to 4 numbered steps with an optional title ("What happens next").
- **`items`**: linked entries (tag, title, summary, meta, link) for digests, multi-item alerts and newsletters.
- **`stats`**: 2 to 4 figures with labels in equal columns. A status is written as a word.
- **Footer product line** (`footer.product`): a line right above the company facts, e.g. "Askbridge by Vitalos" (decision E2).
- **Correspondence mode** (`mode: "correspondence"`): a person writing to a person (inbox replies). No header band, label, logo or badges; only text, quote, divider and signature blocks; a compact footer with the company facts and no social icons, notice or unsubscribe line. The shell's card corners come from a new `[[card_edge]]` slot, so every existing fixture is unchanged.

The Super Admin editor offers all four blocks (Steps, Item list, Figures, Code) with validation: steps 1 to 4, figures 2 to 4 with value and label, items each with a title, and a code that is never in the subject or preheader.
