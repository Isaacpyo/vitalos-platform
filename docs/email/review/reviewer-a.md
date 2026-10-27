# Library review: reviewer (a)

Scope: categories **enquiries** (10), **internal** (4), **sales** (14) and **outreach** (8), which is 36 templates. 19 were changed. I checked them against `docs/email/REVIEW.md`. The copy changes, with reasons, are in `docs/email/copy-changes/reviewer-a.md`.

## Checks

`manage.py review_email_templates --category enquiries --category internal --category sales --category outreach`

| | Review findings | In templates |
|---|---|---|
| Before | 4 | 4 (`enquiry-received` subject length; `meeting-booked-confirmation` and `meeting-reminder-24-hours` with 2 buttons; `proposal-accepted-thank-you` with an exclamation mark) |
| After | 1 | 1 (`enquiry-received` subject length; left on purpose, see below) |

There were no seed problems before or after, and `tests/test_email_templates.py` passes (70 tests). The "labels differ" lines that remain all name labels for different purposes (see each category below).

## Enquiries

The call emails now use one set of header labels: Call booked, Call reminder (both reminders), Call rescheduled, Call cancelled and Missed call. Before, they used five unrelated labels, and the two reminders had different labels. The booking confirmation and the 24-hour reminder had two buttons each. "Join the meeting" stays as the only button, and the reschedule link is now a "Change the time" row in the details, which shows as a link. The acknowledgement's "What happens next" list is now a `steps` block, its closing text comes after the button, and "We reply shortly" no longer promises a response time. The missed-call subject no longer reads "…, there" when the fallback is used, and that email gains a heading like the rest of the category. The invitation subject was reworded because it did not make sense before. Descriptions that said "sent automatically" were corrected, because nothing sends these templates automatically.

## Internal

These were already short and correct. The only change is to the button labels, which now include the article ("Open the lead", "Open the record", "Open the invoice", "Open the task"). Each of the four labels (New lead, Proposal, Payment, Task due) has a different purpose.

## Sales

`proposal-accepted-thank-you` lost its exclamation mark. Its next steps are now a `steps` block, and its label changed from "Thank you" to "Proposal accepted", because closed-lost also used "Thank you". `contract-signed-confirmation` is now "Contract signed" and shows the next steps as text rather than a quote. Neither of those two emails has a heading any more, so they match the other 12 sales emails, which are letters (text, key facts, button, closing text, signature). The first-response subject promised "a few thoughts" the email does not contain. Its preheader read "A personal reply from The Vitalos team" when the fallback was used. Bullets in the discovery-call and proposal emails are now in sentence case. The proposal emails share one label ("Proposal") for sent, day 3 and day 7. "Revised proposal", "For signature" and "Contract signed" are separate purposes.

## Outreach

All eight have a reason line, and the layout adds the unsubscribe footer. The copy was already in voice and makes no claims beyond the site's own copy. The only change: "accepting my connection" became "accepting my connection request". Labels: Introduction (cold, warm referral, LinkedIn), Follow-up (cold follow-ups 1 and 2, event follow-up), Last note and Partnership.

## `DRAFT — needs approval` items

None. I added no copy that needs a fact that has no source.

Existing claims I kept but could not verify. They are not new, and the owner should confirm them:

| Email (key) | Claim |
|---|---|
| enquiry-acknowledgement | "A senior member of the team will read your enquiry properly before replying" |
| meeting-cancelled | "Your enquiry stays on record under the reference below" (depends on the enquiry retention policy) |
| nda-request | "we will review it promptly" |
| proposal-accepted-thank-you | "We will send the contract and statement of work for signature shortly" |
| outreach-cold-introduction | "Vitalos works with organisations like {{organisation}}" |

These are confirmed against the site: "technology consulting, engineering and digital transformation company" (`packages/cms/src/draft/content/pages.ts`), the five practice names, and the offers Technology Health Assessment, Digital Transformation Discovery, Application Modernisation, Systems Integration and Engineering Rescue (`packages/cms/src/locked-copy.ts`).

## Retirement candidates (listed only; nothing archived or deleted)

| Email (key) | Reason |
|---|---|
| password-reset | Duplicates the system set-password email (`apps/accounts/services.password_email`). A reset link has to come from the auth system with a one-time token, so a hand-sent reset email cannot work. It would also teach people to trust reset emails they did not ask for. No client portal exists that would use it. |
| internal-new-lead-assigned | Duplicates the system "Assigned to me" enquiry alert (`apps/enquiries/services.py` queues `assigned_to_me`; the gallery shows it as `enquiry-alert-*`). |
| user-invite (conditional) | `apps/accounts` has no invitation flow. New Super Admin users get a one-time setup link from `manage.py issue_setup_link`, and later resets use the system set-password email. Retire it unless a client portal with invitations is planned. If one is, the portal should send its invitation as a system email. |
| meeting-booked-confirmation, meeting-reminder-24-hours, meeting-reminder-1-hour, meeting-rescheduled, meeting-cancelled (conditional) | Calls are booked through cal.com: ADR-046 records cal.com booking emails arriving in the support mailbox. cal.com sends its own confirmation, reschedule and cancellation emails, and reminders if they are turned on. While those stay on, these templates send a second copy. Either retire them, or keep them only for calls arranged by hand. This needs an owner decision. |

Placement, not retirement: `user-invite` and `password-reset` are account emails filed under Enquiries.

## Variables I would add (not added to `variables.py`)

| Variable | For | Why |
|---|---|---|
| `referrer_name` | outreach-warm-referral-introduction | Its description says to add the referrer's name by hand, but the copy can only say "a mutual contact". |
| `proposal_activity` (viewed or accepted) | internal-proposal-activity | The email has to say "viewed or accepted … the record shows which" because it cannot tell. |
| `support_email` (from Settings > Company) | password-reset, and any email that names support | `support@vitalos.co.uk` is typed into the copy. The footer already reads it from the company record. |
| Internal fallbacks, or `lead_name` / `lead_organisation` | all internal templates | The shared fallbacks are written for the recipient. With missing values an internal email reads "New lead assigned: your organisation" and "Hi there". |

## Deliberately left

- **`enquiry-received`** (`managed_by: website`) is unchanged. Its one finding is the rendered subject length: 63 characters with every fallback. In practice the website's `buildSubject` (`apps/web/src/features/enquiries/adapters/enquiry-notification-email.ts`) builds a longer subject: "New enquiry: {intent up to 40} · {name, organisation} · {reference}". The gallery sample is 78 characters. It is an internal triage line that carries the reference, so the cut-off matters less than it does for client email. If the 60-character rule should apply here too, change `buildSubject` in `apps/web` and then mirror it in the seed. Its preheader, "{{timeframe}} · {{goal}}", relies on the website trimming the goal to 80 characters.
- **Reminder subjects** "Tomorrow: our call at {{meeting_time}}" and "Starting soon: our call at {{meeting_time}}" keep "at", which reads correctly with the fallback "the agreed time".
- **Signatures on account emails** (password reset, invitation) and the call emails are kept: the seed test requires every non-internal template to end with a signature, and the block already uses the sender variables.
- **Greetings**: `meeting-cancelled`, `missed-meeting-follow-up` and `password-reset` keep "Hi {{first_name}}," under a heading that does not use the name. The other enquiry emails put the name in the heading. Block order is the same either way.
- **Button labels** "Arrange a call" (partner) and "Choose a time" (event follow-up, discovery invite) are left. Each matches its own text, and they are verb phrases.
- **PECR**: the proposal follow-ups (day 3 and day 7) and closed-lost are transactional. They concern a proposal the recipient asked for and carry no marketing. `dormant-lead-re-engagement` is outreach and has its reason line.
