# Email

Every email Vitalos and its products send renders on one layout: `@vitalos/email-layout` (ADR-030), mirrored in Python by `superadmin/apps/mailer/layout.py` and vendored by the other repositories at a pinned commit. Inbound automated mail is handled by ADR-046.

| File                                            | What                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `INVENTORY.md`, `inventory.json`                | Every email, by repository, with its state (`layout`, `own-design`, `plain-text`, `bare-html`) |
| `DECISIONS.md`                                  | Decisions of the October 2026 email audit                                                      |
| `REVIEW.md`                                     | The template review checklist                                                                  |
| `COPY-CHANGES.md`                               | Every copy change: email, field, before, after, reason                                         |
| `REPORT.md`                                     | The audit report                                                                               |
| `baseline/`                                     | The emails as they were sent before the audit (HTML and plain text)                            |
| `contact-sheets/before`, `contact-sheets/after` | One sheet per category, light and dark at 600px                                                |

## Commands

```sh
# Super Admin (from superadmin/, with a migrated database)
python manage.py review_email_templates [--category sales] [--strict]   # seed problems and review rules
python manage.py update_seeded_templates --dry-run                       # what a release would update
python manage.py list_automated_enquiries                                # read-only, ADR-046
python manage.py email_gallery --out ../docs/email/gallery --import /tmp/ts-emails

# Website and Relay emails for the gallery (TypeScript)
pnpm --filter @vitalos/web email:gallery /tmp/ts-emails

# Screenshots (600px and 390px, light and dark) and one contact sheet per category
node scripts/email-gallery-shots.mjs docs/email/gallery

# Guard: only the mailer modules call a mail API (also in CI)
pnpm check:email
```

`docs/email/gallery/` is generated and not committed; CI keeps it as a 7-day artifact.

## Adding an email

1. Build an `EmailDocument` (blocks: heading, section, text, button, badge, quote, details, divider, signature, code, steps, items, stats; `mode: "correspondence"` for a person-to-person reply).
2. Send it through the app's mailer: `apps.mailer.system.send(doc, kind=…)` in the Super Admin, which adds `Auto-Submitted` and `X-Vitalos-Notification`.
3. Add it to the gallery (`email_gallery.py`) and give it a test.
