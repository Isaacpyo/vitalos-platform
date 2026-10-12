# Data ownership

One owner per kind of data. Nothing is shared by writing to another system's store. Current state is what the `stage-1` branch implements; future items are marked.

```mermaid
flowchart LR
  Editors([Editors]) -->|pull request| Repo[(Repo<br/>packages/cms/src/repo)]
  Repo -->|"build-time content<br/>public-safe only"| Web[apps/web]
  Visitors([Visitors]) --> Web
  Web -->|"submit_enquiry (one transaction)"| PG[(PostgreSQL<br/>operational records)]
  PG --> Enquiries[enquiries]
  PG --> Outbox[notification_outbox]
  PG --> Buckets[rate_limit_buckets]
  Outbox -->|dispatch| Notifier[Notifier port] -.->|future adapter| Email[Email provider]
  Evidence[Controlled evidence<br/>register or data room, outside the public site] -. "never in the repo" .-> Repo
  Staff([Vitalos staff]) --> SuperAdmin[Super Admin] --> Architecture[(Super Admin PostgreSQL<br/>company architecture, projects, KPIs, decisions)]
```

| Data                                                                                                                                  | Owner                                                             | Notes                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editorial content (practices, offers, case studies, insights, people, labs, trust, legal pages, route copy, redirects, site settings) | Repo (`packages/cms/src/repo`, ADR-028)                           | Typed view models reviewed through pull requests (`docs/cms/editing-site-content.md`). Everything in the repo ships to the public site, so nothing controlled is ever committed |
| Locked copy, route manifest, navigation, publication-gate thresholds                                                                  | Code (`packages/cms`)                                             | Policy, not content. Changes are reviewed code changes (ADR-022)                                                                                                                |
| Design tokens                                                                                                                         | Code (`packages/design-tokens`); Figma is the design authority    | Raw colours exist only here (ADR-016)                                                                                                                                           |
| Enquiries, outbox, rate-limit counters                                                                                                | PostgreSQL (Supabase)                                             | Written only by the server through `SECURITY DEFINER` functions; `anon` and `authenticated` have no privileges; RLS on (ADR-006, ADR-019)                                       |
| Controlled evidence (contracts, client permissions, certificates, audit reports)                                                      | A controlled register outside the public site                     | Not in the repo, in any form. Not yet established; owner decision                                                                                                               |
| Internal company architecture (service lines, practices, solutions, offers, team, projects, KPIs, decisions)                          | Super Admin PostgreSQL (a separate database, never the website's) | Classified Public/Internal/Confidential/Restricted, archived rather than deleted and fully history-tracked (ADR-026)                                                            |
| Secrets                                                                                                                               | Provider encrypted stores                                         | Never in Git, bundles, logs or fixtures (`docs/security/secret-management.md`)                                                                                                  |
| Logs and error reports                                                                                                                | Provider-neutral logger, console today                            | Identifiers, counts and error codes only; personal data redacted by key (`docs/operations/observability.md`)                                                                    |

## Enquiry record rules

- Email is a notification channel, not the database. A failed or missing notification never removes a stored enquiry.
- The enquiry row and its outbox row are written in one transaction; a replayed idempotency key returns the original reference and writes nothing.
- The client IP is stored only as an HMAC under a server-side salt (`ip_hash`). The outbox payload carries identifiers only; personal data is read from the enquiry at send time.
- Consent time and the privacy notice version are stored with each enquiry. `retention_until` is null until the owner approves a retention policy; no deletion job exists.
- Production data is never copied to preview or staging; non-production environments use separate secrets and data (ADR-015).

## Super Admin records

Super Admin owns the internal company architecture records; they are classified Public/Internal/Confidential/Restricted, archived rather than deleted and fully history-tracked. Public clients have no table privileges.

## What the repo content never holds

Prices; evidence itself; client names or logos without verified permission; certifications that are not verified, scoped, dated and current; HTML, CSS or class names; enquiry data. The repo source additionally drops placeholder documents and any text still containing a bracketed placeholder (ADR-028).

## Future

An extracted service owns its persistence and shares no private tables (ADR-010). Any later client, operations or analytics data store needs its own ADR and ownership entry here. No such store exists today.
