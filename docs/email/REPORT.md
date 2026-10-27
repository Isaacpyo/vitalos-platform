# Email audit report (27 October 2026)

Every email sent as Vitalos or a Vitalos product now renders on the shared layout (`@vitalos/email-layout`, ADR-030). The details are in `INVENTORY.md`, `DECISIONS.md`, `COPY-CHANGES.md` and the contact sheets in `contact-sheets/`.

## Done

### Inventory, by repository and state

Sources: code search in every repository the account can reach, Resend's sent list for the last 30 days (127 sends, read-only) and the template library.

| Repository                                  | Before                                                                                                                                                         | After                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| vitalos-platform: Super Admin system emails | 4 plain text (enquiry alert, several updates, digest, password, careers alert: 5 emails), 1 bare HTML (inbox reply), relay and careers candidate on the layout | All on the layout                                                  |
| vitalos-platform: website and Relay         | Enquiry notification and Relay visitor email already on the layout                                                                                             | Unchanged look; now carry the automated-mail headers               |
| vitalos-platform: library                   | 81 templates on the layout                                                                                                                                     | 81 reviewed; 64 changed                                            |
| askbridge                                   | 27 own design (`ab-`), 1 bare HTML                                                                                                                             | 28 on the layout; 3 tenant-branded emails unchanged (out of scope) |
| workforce (Answerd)                         | 25 bare HTML (16 live, 9 dormant)                                                                                                                              | All on the layout                                                  |
| autofix                                     | Inherited SOB Autofix emails (`sobautofix.com`)                                                                                                                | Unchanged: nothing sends as Vitalos yet                            |

Every in-scope email is now at `layout`. Two Resend groups had no current code: the website notification's subject format from before the layout (12 October), and four manual sends by Temitope.

### Emails moved onto the layout

- **Enquiry alerts** (`Enquiries`):
  - A single update has the event and reference as the heading, the subject, sender and channel badges, the message as a quote, the details and an "Open the enquiry" button with a fallback link.
  - Several updates and the daily digest use the new `items` block and an "Open the inbox" button.
- **Password link** (`Account`): heading, why line, "Set a new password" button, "Link expires: 30 minutes, works once" and the not-you line.
- **Careers hiring alerts** (`Careers`): one item per application, with name, received time, a possible-duplicate tag and a link, plus a "Review applications" button.
- **Inbox replies**: correspondence mode, with no header band and a compact company footer. Threading headers and file attachments are kept.
- **Askbridge**: every one of the 28 Askbridge-branded emails: header label "Askbridge", footer "Askbridge by Vitalos", and the `ab-` email design removed (vitalos-technologies/askbridge#74).
- **Answerd**: all 25 emails: header label "Answerd", footer "Answerd by Vitalos" (vitalos-technologies/workforce#177).

### Templates changed

The library review ran in three parts (reviewers a, b and c). 64 of the 81 templates changed; every change is in `COPY-CHANGES.md` and the notes are in `review/`. Main points:

- one block order per category;
- no exclamation marks;
- no subjects or headings that read "…, there" when a name is missing;
- one button per email;
- call emails share one label family;
- invoices and reminders use `stats`, and next-step lists use `steps`;
- the newsletter's stories are `items`;
- reason lines on marketing say truthfully why the person gets the email;
- one spelling, "kick-off".

The review check (`manage.py review_email_templates`) now reports 0 seed problems and 1 finding. The finding is the `enquiry-received` subject (63 characters with fallbacks). That template is managed by the website, whose code (`buildSubject`) sets the real subject.

### New blocks and who uses them

| Block                                                         | Users                                                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `code` (verification code; never in the subject or preheader) | Available to Askbridge; Askbridge's confirmation is a link, so no live email uses it yet                                                                                 |
| `steps`                                                       | Library: enquiry acknowledgement, proposal accepted, client welcome, kick-off agenda. Askbridge: two account emails, domain emails                                       |
| `items`                                                       | Enquiry alerts with several updates, enquiry digest, Careers hiring alert, newsletter. Askbridge: FAQ topics, verify-your-websites host list, notification settings link |
| `stats`                                                       | Library: invoice sent and the three payment reminders. Askbridge: usage and daily summary figures                                                                        |
| Correspondence mode                                           | Inbox replies                                                                                                                                                            |
| Footer product line                                           | Askbridge ("Askbridge by Vitalos"), Answerd ("Answerd by Vitalos")                                                                                                       |

### Automated mail (ADR-046)

The new Automated view stores and searches machine mail, with no alert and no response target. It catches:

- `Auto-Submitted` other than `no`;
- bounces and list mail;
- no-reply addresses (by address, never by display name);
- senders on the editable list in Settings › Email.

Our own notifications carry `X-Vitalos-Notification` and are linked to the enquiry they name.

**One deliberate departure from the brief:** the website's enquiry notification is filed as an enquiry from the person in Reply-To. The brief said it should be linked, not filed. The website doesn't post its enquiries to the Super Admin, so that email is the only way a website enquiry reaches the inbox. VIT-0006 (Chris Sheldrick, what3words) is a real enquiry. A repeat with the same reference is linked rather than filed again. The Askbridge help-centre form works the same way, through `X-Vitalos-Form`.

Existing enquiries are unchanged. `manage.py list_automated_enquiries` (read-only) lists the ones to tidy. From the evidence in Resend:

| Enquiry                                          | Now                               | Would be                                                                                                                                |
| ------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| VIT-0002 "Askbridge help centre: Something else" | Enquiry from `no-reply@askbridge` | Listed as automated, because the old message had no `X-Vitalos-Form`. If it was a real request, set the sender to the person who wrote. |
| VIT-0003, VIT-0004 (cal.com)                     | Enquiries                         | Automated (sender list)                                                                                                                 |
| VIT-0006 (website notification)                  | Enquiry from support@             | Listed as "from a Vitalos address". It is Chris Sheldrick's website enquiry; reply to the address in the email.                         |
| VIT-0008 (domain verified in another workspace)  | Enquiry                           | Automated (no-reply address)                                                                                                            |

Run `python manage.py list_automated_enquiries` in production for the full list.

### CI guard

`tooling/scripts/check-email-senders.mjs` runs in CI's `quality` job and in the Super Admin workflow. It fails when anything other than the four mailer modules calls a mail API. Exceptions live in `tooling/email-senders.allow`, one reason each; there are two today: reading received mail, and the Resend URL setting. Askbridge and Workforce have the same guard (`scripts/check-mail-senders.mjs`, `scripts/check-email-senders.mjs`). The rule is written up under "Email" in `AGENTS.md` here and in Askbridge's `CLAUDE.md`. In Workforce it is in the module README, because Workforce's `AGENTS.md` is owned by its orchestrator.

### Gallery and test sends

- **Gallery:** `manage.py email_gallery` renders all 160 emails (this repository, the website and Relay, Askbridge and Answerd) in light, dark and plain text, filterable by repository, category and state. CI builds it with screenshots at 600px and 390px in both colour schemes and keeps it as a 7-day artifact.
- **Committed:** the before baseline (`baseline/`), and before and after contact sheets, one per category, each 2 MB or less.
- **Mailpit equivalent:** no Mailpit in this environment, so the same checks ran on the real built messages. All 97 Super Admin and library emails passed: multipart/related with both alternatives, every CID resolves, `Auto-Submitted` and `X-Vitalos-Notification` on automated mail, `List-Unsubscribe` on outreach and marketing, and every email under 100 KB (largest 37 KB).
- **Test sends:** 13 `[TEST]` sends went to temitope.agbola@vitalos.co.uk, and Resend reports all 13 delivered:
  - three enquiry alerts (single, several, digest), the password email, an inbox reply and a Careers alert;
  - three library templates, one per review group (proposal, invoice, newsletter), and one email with every new block;
  - Askbridge's confirmation, invitation and domain alert.
  - Answerd sends through Amazon SES, so it isn't in this set; its rendered samples are in the gallery.
- **What to check in Outlook desktop:** the header band stays midnight, the label pill is legible, buttons are full width with square corners (expected in Outlook), the `stats` cells align, and the `items` rules show.
- **What to check in Gmail on a phone:** dark mode keeps the white logo on midnight, nothing is clipped, the code box doesn't overflow at 390px, and the inline images show without "display images".
- **What to check in Apple Mail:** light and dark both follow the system, the reply has no header band, threading of the reply is kept, and the fallback link under each button can be copied.

### Production update counts

These are filled in after the Super Admin deploy from `bin/release.sh`, which runs `update_seeded_templates`. Expected: 64 templates updated, unless someone edited them in the admin, in which case they are skipped and listed.

### Pull requests

- vitalos-technologies/vitalos-platform: this pull request
- vitalos-technologies/askbridge#74
- vitalos-technologies/workforce#177

## Needs approval

- **Copy to confirm** (no `DRAFT — needs approval` text was added; nothing new was claimed):
  - five existing claims in enquiry templates, for example "A senior member of the team will read your enquiry" (`review/reviewer-a.md`);
  - the final notice's "pause work and refer the matter on", and the support offer's bullets (`review/reviewer-b.md`).
- **Kind changes under PECR:**
  - `client-referral-request`: transactional to marketing;
  - `support-and-maintenance-offer`: transactional to outreach;
  - the marketing reason lines now say people "agreed to receive email updates from Vitalos". Confirm every marketing list holds such consent.
- **Retirement candidates** (nothing archived):
  - `password-reset` and `internal-new-lead-assigned`, which duplicate system emails;
  - `user-invite`, if no client portal is planned;
  - the five call emails, if cal.com keeps sending its own;
  - `client-welcome`, which overlaps two sales templates;
  - the five near-identical case-study templates. Don't activate these until a verified case study exists.
- **Variables proposed** (not added): `referrer_name`, `proposal_activity`, `support_email`, `quote_valid_until`, `survey_link`, `booking_link`. Also refuse a send when `amount`, `invoice_number`, `due_date` or a link is empty.
- **Askbridge:** visitor emails go out with the From name "Askbridge" while the body is branded as the business (ADR-0012 open question).
- **Answerd:** most emails have no button until the website has the matching routes. The list is in Answerd's inventory.
- **Mail outside Vitalos:** nothing in this work emails anyone outside Vitalos. The emails themselves still go to their usual recipients (customers, candidates) as before.
- **DNS for `notify.` and `news.vitalos.co.uk`:** not touched. Relay sends from `relay@notify.vitalos.co.uk`, and Resend lists only `vitalos.co.uk`, `askbridge.vitalos.co.uk` and `inbound.askbridge.vitalos.co.uk`. Verify `notify.vitalos.co.uk` in Resend before Relay emails go live. `news.` is not used yet.
- **Resend plan:** no change. Sends stay within the free tier's daily limit (`RESEND_DAILY_LIMIT`).

## Out of scope, listed

| Sender                                                                    | What can be configured                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TipSignal, Fauward, SOB Autofix                                           | Separately branded; their own designs stay                                                                                                                                                                                               |
| Autofix (Vitalos's garage platform)                                       | It sends only inherited SOB Autofix email today. Platform email to garages from `autofix.vitalos.co.uk` should use the vendored layout when it is built (BUILD-PLAN P2.10). Email to a garage's customers goes under the garage's brand. |
| Askbridge tenant emails (replies, request updates, email-channel replies) | Branded as the business; unchanged                                                                                                                                                                                                       |
| Workforce outbound correspondence and the portal magic link               | Tenant brand, and nothing is sent in M1                                                                                                                                                                                                  |
| cal.com                                                                   | Branding and which emails it sends are set in cal.com; its mail is now filed under Automated                                                                                                                                             |
| Google and Microsoft (calendar and account mail)                          | Not configurable; filed under Automated when it carries `Auto-Submitted` or comes from a no-reply address                                                                                                                                |

## Blockers

None that stopped the work. Where the environment differed from the brief:

- **No VM slot or Mailpit.** This ran in a cloud container: Django tests on SQLite locally and PostgreSQL in CI, MIME checks on the built messages.
- **No `relay` repository.** Askbridge is `vitalos-technologies/askbridge`, confirmed by all four markers.
- **No `gh` CLI.** Repositories were found through the session's repository list and GitHub tools.

## Created

- **Migrations:**
  - `enquiries.0002`: Automated status and the booking-sender list;
  - `email_templates.0002`: `seed_hash`, back-filled from the seeded snapshots.
- **Commands:** `review_email_templates`, `update_seeded_templates` (in `bin/release.sh`), `email_gallery`, `list_automated_enquiries`; `pnpm --filter @vitalos/web email:gallery`; `scripts/email-gallery-shots.mjs`.
- **Headers:** `X-Vitalos-Notification`, `X-Vitalos-Reference`, `X-Vitalos-Form`.
- **CI:** the email guard here, in Askbridge and in Workforce; the layout-vendoring check in Askbridge and Workforce; the email gallery artifact.
- **Vendored copies:** `askbridge/vendor/email-layout` and `workforce/modules/marketplace/vendor/email-layout`, both at `f987e9e`. Move the pin once this pull request is merged.
- **ADRs:** ADR-030 status note and ADR-046 here; ADR-0012 in Askbridge; D160 to D164 in Workforce.
