# Production cutover

Confirm source deployment, DNS/MX inventory, canonical host, URL/redirect inventory, owners and rollback target. Freeze structure, publish approved CMS content, tag release, smoke-test the candidate, change only approved DNS/alias records, verify TLS/canonicals/navigation/forms/redirects/analytics, then monitor errors, latency and enquiry delivery. Explicit owner authorization is mandatory.

Status (10 Oct 2026): not rehearsed and not authorised. Launch gate G10 is open (`docs/delivery/stage-status.md`).

## Preconditions (all must be true)

1. Gates G0-G10 are met or explicitly descoped by the owner; no date overrides a gate (`docs/delivery/launch-gates.md`).
2. Owner inputs for the production site are in place (`docs/delivery/owner-decisions.md`): canonical host, legal identity, privacy notice and version, approved content above the publication gates, a Supabase production project, Turnstile production keys.
3. Production environment variables are set and the build passes the production configuration rules, including explicit `VITALOS_CONTENT_SOURCE`, `VITALOS_ENQUIRY_BACKEND` and an https `NEXT_PUBLIC_SITE_URL` (`docs/operations/deployment.md`).
4. Enquiry delivery is decided: an approved email adapter and scheduler, or a named person who runs `docs/runbooks/enquiry-delivery-failure.md` on a schedule. Without a notifier, enquiries are stored but nobody is notified.
5. The redirect inventory is complete and reviewed (`docs/seo/redirect-inventory.md`); the four seeded redirects have live destinations.
6. Named release owner, incident owner and the rollback target (previous deployment and DNS values) are recorded.

## Smoke test on the candidate

`/api/health`; response headers; `robots.txt` and `sitemap.xml` for production; navigation shows only gate-open sections; contact form submits and the enquiry appears in the database and outbox; redirects and 410 behave per inventory; canonical and Open Graph URLs use the canonical host; the candidate is indexable only in the production environment.

## After the switch

Verify TLS, canonical URLs, navigation, forms, redirects and analytics (if approved). Enable HSTS only after the canonical host is validated and the owner approves (`ENABLE_HSTS`). Monitor errors, latency and the outbox for the agreed window.
