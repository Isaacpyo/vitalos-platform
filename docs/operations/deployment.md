# Deployment

Vercel is the intended web host, site content ships with each deployment from the repository (ADR-028), and Cloudflare retains DNS ownership (ADR-004, ADR-007, ADR-015). Pull requests receive previews; production requires launch-gate approval, a tagged release, a recorded owner and a rollback target.

This repository contains no authorisation to connect or deploy any production system. Production deploys, DNS changes, secret rotation and production data deletion need explicit owner approval (`AGENTS.md`).

Not recorded in the repository: Vercel project settings (root directory, install and build commands, domains) and project or team identifiers; the only `vercel.json` is `apps/web/vercel.json`, which declares the outbox cron (see "Outbox scheduler"). Everything else is set by the owner in Vercel. Preview deployments of Stage 1 pull requests currently report "Deployment was blocked" until Vercel team access is fixed (owner decision 24, `docs/delivery/owner-decisions.md`).

## How the deploy environment is decided

`@vitalos/config` (`packages/config/src/schema.ts`) validates the environment at build and start. `NODE_ENV` is never used: every `next build` sets it, including local and CI builds.

- `VITALOS_DEPLOY_ENV` (`local`, `preview`, `staging`, `production`) wins when set. Otherwise `VERCEL_ENV` maps `production` to production and `preview` to preview; everything else is `local`.
- `VITALOS_DEPLOY_ENV` may not be `local` or `preview` when `VERCEL_ENV=production`.
- Only `production` is indexable. Every other environment sends `X-Robots-Tag: noindex, nofollow` and a `robots.txt` that disallows everything.
- Invalid production configuration fails the build, before anything is served. Error messages name variables, never values.

## Variables by environment

Public variables are inlined at build time (`NEXT_PUBLIC_*`); changing one needs a rebuild. Secrets live only in each provider's encrypted store, are distinct per environment, and never use a `NEXT_PUBLIC_` prefix (`docs/security/secret-management.md`).

| Variable                                                        | local                               | preview and staging                                             | production                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITALOS_DEPLOY_ENV`                                            | optional                            | derived from `VERCEL_ENV` or set `staging`                      | `production` (or `VERCEL_ENV=production`)                                                                                                                                                                                                                                                                             |
| `NEXT_PUBLIC_SITE_URL`                                          | defaults to `http://localhost:3000` | defaults to `https://$VERCEL_URL` on Vercel; required elsewhere | **Required, https origin, no path** (the canonical host: owner decision)                                                                                                                                                                                                                                              |
| `VITALOS_CONTENT_SOURCE`                                        | optional (`repo` by default)        | any except production rules                                     | **Required, explicit**: `repo` (ADR-028), or `empty`; `fixtures`, `draft` rejected                                                                                                                                                                                                                                    |
| `VITALOS_ENQUIRY_BACKEND`                                       | optional (`disabled` by default)    | `supabase`, `memory` or `disabled`                              | **Required, explicit**: `supabase` or `disabled`; `memory` is rejected                                                                                                                                                                                                                                                |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (20+)                     | local stack values                  | a non-production project only                                   | **Required** when the backend is `supabase`                                                                                                                                                                                                                                                                           |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`        | test keys allowed                   | test keys allowed                                               | **Required as a pair** with `supabase`; Cloudflare test keys are rejected                                                                                                                                                                                                                                             |
| `ENQUIRY_IP_HASH_SALT` (16+ chars)                              | required for `supabase`             | required for `supabase`                                         | **Required** with `supabase`                                                                                                                                                                                                                                                                                          |
| `ENQUIRY_PRIVACY_NOTICE_VERSION`                                | optional                            | optional                                                        | **Required** with `supabase`; exactly the version of the published privacy notice                                                                                                                                                                                                                                     |
| `OUTBOX_DISPATCH_SECRET` (32+ chars), `CRON_SECRET` (32+ chars) | for manual dispatch                 | for dispatch testing                                            | the dispatch endpoint accepts either as its bearer (503 when neither is set; not enforced by the schema). Vercel sends `CRON_SECRET` from `apps/web/vercel.json` (see Outbox scheduler below)                                                                                                                         |
| `EMAIL_PROVIDER`                                                | `none` or `console`                 | `none`, `console`, `postmark` or `resend` (non-production keys) | `none` until the owner approves a provider, then `postmark` or `resend`; `console` is **rejected**; `none` is **rejected** once `ENQUIRY_NOTIFICATION_TO` is set                                                                                                                                                      |
| `EMAIL_PROVIDER_API_KEY` (server-only), `EMAIL_FROM`            | unused                              | required with `postmark` or `resend`                            | **Required** with `postmark` or `resend`; `EMAIL_FROM` is a provider-verified sender (`addr` or `Name <addr>`); with `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` (server-only) is accepted as a fallback and `EMAIL_PROVIDER_API_KEY` wins if both are set; the key is never logged or bundled (`check:bundle-secrets`) |
| `ENQUIRY_NOTIFICATION_TO`                                       | unused                              | required with `postmark` or `resend`                            | internal recipient; a valid email; **required** with `postmark` or `resend`; setting it requires a provider other than `none`                                                                                                                                                                                         |
| `ENABLE_HSTS`                                                   | ignored                             | optional                                                        | `false` until the owner approves; never adds `includeSubDomains` or preload                                                                                                                                                                                                                                           |

**Warning:** setting `ENQUIRY_NOTIFICATION_TO` in production before a provider (`EMAIL_PROVIDER` plus `EMAIL_FROM` and `EMAIL_PROVIDER_API_KEY`) is configured makes configuration validation fail and the deployment refuse to build or start. This is fail-closed by design: a recipient with no provider would otherwise silently never notify.

### Outbox scheduler

`apps/web/vercel.json` declares one Vercel Cron job that calls `/api/internal/outbox/dispatch` once a day (`0 6 * * *`, UTC). The Hobby plan allows one run per day. `after()` after an accepted enquiry remains the immediate dispatch path; the cron is the safety net that drains anything `after()` missed (a crash, a timeout, a provider outage). Set `CRON_SECRET` (32+ characters) in the Vercel project; Vercel then sends `Authorization: Bearer $CRON_SECRET`. The route accepts `CRON_SECRET` or `OUTBOX_DISPATCH_SECRET` (timing-safe comparison), and answers 503 when neither is set. A paid plan can shorten the schedule without code changes beyond `vercel.json`.

Caveats: Vercel runs crons **only on production deployments** (not previews), and reads `vercel.json` from the project's **Root Directory**, so the Vercel project must have Root Directory set to `apps/web`. To check, open the project in Vercel, Settings, General, Root Directory; after the first production deploy, Settings, Cron Jobs must list `/api/internal/outbox/dispatch` with its schedule. If it is missing, the Root Directory is wrong. The owner approved enabling the cron on 11 October 2026.

### Notification address and sender

The recommended provider is Resend (`EMAIL_PROVIDER=resend`). Once the owner approves the provider and the SPF and DKIM records for `vitalos.co.uk` are in place, set in the Vercel project (never in source):

```
ENQUIRY_NOTIFICATION_TO=support@vitalos.co.uk
EMAIL_FROM=Vitalos <support@vitalos.co.uk>
```

`EMAIL_PROVIDER_API_KEY` is set only in the Vercel project. Setting `ENQUIRY_NOTIFICATION_TO` before the provider is configured fails validation (see the warning above).

Other cross-field rules: the site URL must be an http(s) origin (path, query or fragment rejected); `supabase` needs its URL and secret; the two Turnstile keys must be set together.

## Production prerequisites

Do not set production variables until the matching owner inputs exist (the owner's decision log (kept privately, outside this repository)). In order:

1. Gates G0-G10 reviewed with the owner; no date overrides a gate (`docs/delivery/launch-gates.md`).
2. Approved site content merged into `packages/cms/src/repo` (`docs/cms/editing-site-content.md`); content is built into each deployment, so there is no CMS project, dataset or webhook to configure.
3. Remote Supabase project; the owner applies the three migrations (`supabase/migrations`) with their own credentials. Agents never run `supabase link` or `push`.
4. Turnstile production keys; enquiry secrets; privacy notice published and its version set.
5. An email `Notifier` adapter, provider account and DNS records (SPF, DKIM) approved and in place. Until then enquiries are stored but nobody is notified; see `docs/runbooks/enquiry-delivery-failure.md`.
6. `CRON_SECRET` set in the Vercel project so the daily cron in `apps/web/vercel.json` can authenticate (see Outbox scheduler and notification address below).
7. Canonical host and DNS plan; then `docs/runbooks/production-cutover.md`.

## Smoke checks after any deployment

- `GET /api/health` returns `{"status":"ok","service":"web"}`.
- Response headers: CSP, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`; `X-Robots-Tag: noindex, nofollow` on every non-production environment and absent in production.
- `/robots.txt` and `/sitemap.xml` match the environment (disallow all outside production; sitemap lists only published, gate-open pages).
- `/contact` shows the form only when enquiries can be stored and a privacy notice is published.
- A legacy URL from the seed (for example `/services`) returns a 301 to its destination.

## Environments

Local, per-PR preview, optional staging and protected production (ADR-015, `docs/architecture/environment-model.md`). Use isolated secrets and data, noindex preview and staging, production-only analytics and never copy live enquiries into other environments. A dedicated staging environment depends on plan and workflow justification and is not set up.

## Never promote a draft or fixtures build

Pages are prerendered at build time with the content source of the build environment. A preview or staging build made with `VITALOS_CONTENT_SOURCE=draft` or `fixtures` must never be promoted to production (for example Vercel "Promote to Production"); rebuild in the production environment instead. The guard is the build-time check in `apps/web/next.config.ts` (`readBuildEnv()`), which fails a production build that uses either source, and `VERCEL_ENV=production` with a non-production `VITALOS_DEPLOY_ENV` is rejected (ADR-025).
