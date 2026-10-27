# Library review: reviewer (b), service, delivery and finance

Review of October 2026 against `docs/email/REVIEW.md`. Scope: the 34 seed templates in `superadmin/apps/email_templates/seed/service.json` (15), `delivery.json` (13) and `finance.json` (6). Every template was changed; each change is in `docs/email/copy-changes/reviewer-b.md`. No template in these categories is `managed_by: website`.

`manage.py review_email_templates --category service --category delivery --category finance`:

- Before: 34 templates, 0 seed problems, 3 review findings in 3 templates (an exclamation mark in `go-live-announcement`; the sentence-case heuristic on the two Managed Services subjects).
- After: 34 templates, 0 seed problems, 2 review findings in 2 templates (the two Managed Services subjects, left on purpose: see "Left deliberately").

## Decisions that apply to all three categories

- **Letter style, no heading.** Most emails in each category already opened with "Hi {{first_name}}," and no heading (service 10 of 15, delivery 8 of 13, finance 5 of 6). The others now do the same. Their headings all used `{{first_name}}` after something other than "Hi" ("Thanks again, there", "Congratulations, there"), which reads badly with the fallback.
- **Block order** in every email: opening text, key facts (details, steps, stats or a quote), button, closing text, signature. Sentences that came after the ask (reassurance, "no obligation", "if you have already paid") now sit after the button.
- **Button labels** are verb phrases with the article where it was missing ("View the invoice", "Open the handover pack", "Review the access request"), one button at most, all on `https:` variables.
- **Capitalisation.** The five practice names (Consulting, Engineering, AI & Data, Experience, Managed Services) and the offer names (Technology Health Assessment, Managed Engineering & Application Care, …) stay capitalised as proper names. That is how the website and Relay copy write them (`packages/relay-knowledge/content/practices.md`, `packages/cms/src/draft/content/offers.ts`). When the copy describes a kind of work rather than naming the practice it is lower case, as it already was ("a managed services case study", "our consulting practice").
- **No claims added.** Service descriptions were only shortened or moved. Every offer named in an introduction maps to that practice in `offers.ts`.

## Service (15 templates)

Five practices × three purposes: introduction (outreach), case study share (outreach) and post-enquiry follow-up (transactional). All outreach templates have a reason line, and the kinds are correct.

- Introduction labels changed from the practice name to **Introduction**. The rule is one label per purpose, and the outreach category's introductions already use "Introduction". The practice is named in the subject and the first line. Category labels are now Introduction, Case study and Follow-up.
- Follow-ups no longer thank the reader twice (the "Thanks again" heading followed by "Thank you for your enquiry"). The practice-specific questions and security notes are unchanged.
- Case-study closings no longer start with "And" or use "just".

## Delivery (13 templates)

- `support-and-maintenance-offer` changed from **transactional to outreach**, with a reason line. It offers a further paid service (Managed Engineering & Application Care). Under PECR that is direct marketing even to an existing client: the soft opt-in still needs an opt-out in every message. A transactional email must carry no marketing.
- New blocks are used in two places only: a `steps` block for the three first steps in `client-welcome`, which happen in order, and a numbered "Agenda" `steps` block in `kickoff-agenda-and-preparation`. Other bullet lists are not sequences (contents of a pack, things to have ready) and stay as bullets.
- Subjects that began with a variable now start with a word ("Status update: {{project_name}}", "Now live: {{project_name}}"). With the fallback they used to start in lower case ("your project is live"). `client-welcome` dropped `{{first_name}}` from its subject ("Welcome to Vitalos, there").
- `go-live-announcement` loses its exclamation mark ("Congratulations: {{project_name}} is now live.").
- `project-plan-shared`: "Link available until" became "Link expires", because `link_expiry` is a phrase such as "in 7 days".

## Finance (6 templates)

- Invoice and reminders use a `stats` block for the key figures: Amount and Due date (`invoice-sent`, `payment-reminder-friendly`), or Amount and Status "Overdue" (`payment-reminder-overdue`, `payment-reminder-final-notice`). The status is written as a word. In the overdue emails the due date and days overdue stay in the opening sentence: a "Days overdue: a few" cell read badly with the fallback, and a long date wraps in a three-column row at 390px. The invoice number is in each subject and opening line.
- `quote-sent` and `payment-received-receipt` keep their details tables: a quote has no due date or status, and a receipt is a record. The receipt shows no "Paid" status because a payment may be partial.
- `invoice-sent` asks readers to check bank-detail changes "with us" rather than "with {{sender_name}}" (the fallback read "check with The Vitalos team").
- `payment-reminder-friendly` preheader no longer reads "Due on the due date." with the fallback.
- Header labels stay distinct by purpose (Quote, Invoice, Reminder, Overdue, Final notice, Receipt), as `REVIEW.md` allows.

## DRAFT — needs approval

None were added: no new copy needs a fact the sources do not give. Two existing sentences should be checked against the terms of business before these templates go live. They were not marked DRAFT because they are unchanged:

- `payment-reminder-final-notice`: "If we do not hear from you, we may need to pause work and refer the matter on." Confirm the contract allows pausing work, and what "refer the matter on" means (collections, legal).
- `support-and-maintenance-offer`: the bullets "dependency management", "monitoring and reliability improvements" and "security patches" go slightly beyond the offer's published outputs in `offers.ts` ("maintenance, defect fixes and updates", "incident support and monitoring coordination", "an improvement backlog"). Confirm them, or align them to the offer wording.

## Retirement candidates

Listed only; nothing was archived, deleted or merged.

| Template(s)                                                                                                | Reason                                                                                                                           | Suggestion                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client-welcome` (delivery), with `proposal-accepted-thank-you` and `contract-signed-confirmation` (sales) | Three emails sent around signature each set out "what happens before kickoff". A client who signs may get all three within days. | Owner to choose the sequence. If the welcome is kept as the hand-off to the delivery lead, cut the next-steps lists from the sales emails, or retire `proposal-accepted-thank-you`. |
| `service-case-study-consulting`, `-engineering`, `-ai-data`, `-experience`, `-managed-services`            | Near-identical copy with only the practice word changed.                                                                         | Optional: keep one generic case-study share using `{{service}}` and retire four. The reason lines differ slightly, so the owner should decide.                                      |

Also, **do not activate the five case-study templates until a verified case study exists**. `packages/cms/src/content/gates.ts` drops placeholder case studies, and none is verified yet. With no title, the `case_study_title` fallback reads "might be of interest: a recent project."

## Variables I would add (not added to `variables.py`)

- `quote_valid_until`: `quote-sent` says the quote states its validity but cannot show the date.
- `support_email`, from Settings > Company: `client-welcome` and `go-live-announcement` hard-code `support@vitalos.co.uk`. The footer already reads the company's support email.
- Missing-value behaviour rather than a new variable: `amount` falls back to "£0.00", `invoice_number` to "INV-0000" and `due_date` to "the due date". A finance email sent with those would be wrong, not just awkward. Likewise `document_link`, `meeting_link` and `action_link` fall back to the contact page, so "View the invoice" or "Join the meeting" would open /contact. I recommend that a send refuse to go when these variables have no value, rather than use the fallback.

## Left deliberately

- **Two sentence-case findings**, on `service-intro-managed-services` ("Vitalos Managed Services: steady, supported systems") and `service-follow-up-managed-services` ("Your Vitalos Managed Services enquiry: next steps"). "Managed Services" is a proper name (see Capitalisation). The heuristic in `review.py` flags any subject with two capitalised words outside `PROPER_NOUNS`. The other four practices pass only because their names are one word. Fix: teach `review.py` the practice names as phrases. Adding "Services" alone to `PROPER_NOUNS` would hide real mistakes. `review.py` is outside this reviewer's scope.
- **Label differences** that `label_consistency` reports in all three categories are differences between purposes, which `REVIEW.md` allows. Within a purpose the labels are now identical.
- **"Kickoff" vs "kick-off"**: delivery writes "kickoff" throughout; sales (`proposal-accepted-thank-you`, `contract-signed-confirmation`) writes "kick-off". One spelling should be chosen across categories; that is for the sales reviewer or the owner.
- `project-status-update`, `go-live-announcement` and `payment-received-receipt` have no button: none has a single action, and inventing one would add a link the sources do not give.
- `{{goal}}` in the service follow-ups is quoted as the enquirer wrote it, unchanged.
