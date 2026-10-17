# WS5 notes: measurement, SEO, security headers, accessibility, performance

Branch `review/ws5-measurement`. Findings C1, C3–C11, with verification of A8, A9 and C2. ADRs 046 (analytics) and 047 (CSP and headers).

## What shipped

(filled in at the end of the run, see the bottom of this file)

## Draft privacy-notice paragraph (owner approval; not published)

The privacy notice (`packages/cms/src/repo/legal.ts`, version `2026-10-analytics`) already names Vercel Web Analytics and Speed Insights. Before custom events are kept (they need a paid Vercel plan, ADR-046), its last sentence in "Website analytics" would change.

Current: "We may also count when a "Talk to Vitalos" link is clicked or an enquiry is accepted; these counts contain no personal data or form content."

Draft: "We may also count a small number of actions: when a button or a link to another website is clicked (we record the button's label or the other website's name, and the page it was on), when an enquiry or job application form is started or sent, and when Relay, our website assistant, is opened, asked a question or asked to put you in touch with a person. These counts contain no personal data, no form content and no question text."

Source: the existing notice wording and the event list in ADR-046. Publishing it needs a new notice version (`ENQUIRY_PRIVACY_NOTICE_VERSION` changes with it, docs/seo/DECISIONS.md 29).
