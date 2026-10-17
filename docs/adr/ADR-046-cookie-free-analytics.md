# ADR 046 Cookie-free analytics: event names, the `track()` helper and the Relay contract

Status: Accepted (engineering), 17 Oct 2026, review run WS5. Amends docs/seo/DECISIONS.md 23 and ADR-020 decision 10 (analytics contract). Switching custom events on is an owner decision (a paid Vercel plan).

## Context

The 17 Oct review recorded finding C1, "no analytics of any kind". The code says otherwise. `@vercel/analytics` and `@vercel/speed-insights` were added on 16 Oct (docs/seo/DECISIONS.md 23) behind `NEXT_PUBLIC_ANALYTICS_PROVIDER` (`none` | `vercel`), and the owner switched them on (DECISIONS 29 and 30). The live bundle on 17 Oct has `analyticsEnabled` compiled to `true`, and `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js` answer 200 on `vitalos.co.uk`. Page views and Speed Insights are therefore being collected. The review most likely missed them because both scripts are first-party (`/_vercel/…`), set no cookie and load after hydration, so a cookie or third-party-request audit finds nothing.

What was missing was the event set the review asks for. The Vercel team is on the Hobby plan, and custom events need Pro: on Hobby, `track()` calls are accepted and dropped. The taxonomy also used older names (`contact_submit`, `primary_cta_click`, `application_submit`), and only two events were wired.

## Decision

1. **One provider and one flag.** No second analytics system and no `NEXT_PUBLIC_ANALYTICS_ENABLED`. The run brief's flag is the existing `NEXT_PUBLIC_ANALYTICS_PROVIDER`: `vercel` turns everything on and `none` (the default) turns everything off. Production must stay on `vercel`, which it already is. A deploy without it records nothing.
2. **The taxonomy uses the brief's names** (`apps/web/src/features/analytics/events.ts`): `enquiry_started`, `enquiry_sent`, `application_started`, `application_sent`, `relay_opened`, `relay_question`, `relay_handoff`, `cta_click {label, page}` and `outbound_click {host, page}`. The content events (`case_study_view`, `insight_to_offer_click`, `lab_resource_click`, `insight_read`) are kept. `contact_submit`, `primary_cta_click` and `application_submit` are replaced. `offer_enquiry_submit` and `trust_enquiry_submit` were never wired, duplicated `enquiry_sent`, and are removed. No history is lost, because Hobby dropped every custom event.
3. **Properties hold no personal data by construction.** Every property is a slug, a path without a query string, or a host name. `label` is the CTA's visible text, slugified (`Talk to Vitalos` becomes `talk-to-vitalos`); that text is site copy, never something the visitor typed. Form contents, references, emails, names and Relay question text are never passed. Page views already drop the query string (`beforeSend`).
4. **`track(name, properties)` (`features/analytics/track.ts`) is the only way browser code records an event.** It is typed against the taxonomy, imports the schemas as types only (zod stays out of the client bundle, DECISIONS 27) and never throws. It announces each event on `window` as a `vitalos:analytics` CustomEvent, which is how the Playwright suite observes events with the provider stubbed (nothing leaves the page that way), and then forwards it to Vercel when the provider is on.
5. **Events come from delegated listeners in `SiteAnalytics`, not from page markup:**
   - `cta_click`: a click on any `Button` link (`@vitalos/ui` marks it `data-cta`) or any link to `/contact`;
   - `outbound_click`: a link to another origin (the host only);
   - `enquiry_started` and `application_started`: the first `focusin` or `input` in a `<form data-analytics-form="enquiry|application">`, once per form per page view;
   - `enquiry_sent`: the receipt page (`/contact/thank-you`, `TrackOnMount`); `application_sent`: the application form's success state.
6. **Relay contract.** The widget package must not import the site. It dispatches `window.dispatchEvent(new CustomEvent("vitalos:relay", { detail: { type } }))` with `type` set to `"opened"`, `"question"` or `"handoff"`, and `SiteAnalytics` maps these to the `relay_*` events with the current page. The widget sends nothing else, and no question text.

## Consequences

- With `vercel` on the Hobby plan: page views and Speed Insights (Core Web Vitals at p75) are recorded, and the custom events are wired and tested but dropped by Vercel. Keeping them needs Vercel Pro, which costs money, so it is an approval item. The alternative is a self-hosted, cookie-free counter (for example Plausible Community Edition), prepared only if the owner prefers it.
- The privacy notice (`2026-10-analytics`) already covers Vercel Web Analytics. Its sentence about "Talk to Vitalos" clicks and accepted enquiries needs the wider wording in `docs/review-2026-10-17/ws5/NOTES.md` before custom events are switched on.
- The CSP needs no third-party source: the scripts and their beacons are same-origin (`/_vercel/insights/*`, `/_vercel/speed-insights/*`).
- Tests: unit tests for the taxonomy, the validating sink and `slugifyLabel`; Playwright `tests/end-to-end/analytics.spec.ts` (CTA, outbound, enquiry, Relay, no personal data) and `tests/content/careers.spec.ts` (application events).

## Options considered

- A second flag, `NEXT_PUBLIC_ANALYTICS_ENABLED`: rejected, because it would be a second switch for the same thing.
- Calling `track()` inside each CTA component: rejected. One delegated listener covers every current and future CTA, and the markup needs no analytics code.
- Importing `track()` into `@vitalos/relay-widget`: rejected, because a package may not import an app (AGENTS.md). A DOM event keeps the widget independent of the site.
- Google Analytics or another cookie-setting tool: rejected under decision 5 (privacy-first, cookie-free).
