# Email review: reviewer (c)

27 October 2026. Scope: seed categories **retention** (6 templates) and **marketing** (5 templates), and a copy review of the system emails moved onto the shared layout: enquiry alert (one update and several updates), enquiry digest, the password link, the careers hiring alert, the inbox reply and the `link_fallback` helper. Every change is listed in `docs/email/copy-changes/reviewer-c.md`.

## Results

| Check                                                              | Before                                           | After                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `review_email_templates --category retention --category marketing` | 11 templates, 0 seed problems, 0 review findings | 11 templates, 0 seed problems, 0 review findings                                                                                                                                                                                                                               |
| Label notes from the command                                       | retention and marketing each use several labels  | unchanged, on purpose (see below)                                                                                                                                                                                                                                              |
| Templates changed                                                  |                                                  | retention 6 of 6, marketing 5 of 5                                                                                                                                                                                                                                             |
| Moved emails changed                                               |                                                  | Functions edited: `link_fallback`, `_single_document`, `build_email` (digest heading), `alert_email`. Unchanged: `_list_document`, `SETTINGS_NOTICE`, `password_email`, `reply_document`. Emails affected: 5 of 6 (all but the inbox reply, some only through `link_fallback`) |
| Super Admin tests                                                  |                                                  | 821 passed, 1 skipped (PostgreSQL only)                                                                                                                                                                                                                                        |

The command's mechanical rules already passed, so most changes come from the person-checked rules: category block order, PECR kind and reason lines, fallbacks that read badly, claims no source supports, and plain text.

**Header labels.** Both categories report "labels differ". That is correct here: every template in these categories has a different purpose, and REVIEW.md allows different labels for different purposes. The one shared purpose, thanks, already uses "Thank you" in both categories. No label changed.

**Rendered lengths** (gallery sample values / variable fallbacks): every subject is 16 to 53 characters, every preheader 49 to 81 characters.

## Retention

Order now: heading (where used), opening text, key facts, button, closing text, signature. The feedback survey, renewal reminder and offboarding email had their closing line inside the opening text, before the button; it now follows the button. Testimonial and referral requests split their closing line into its own block (no visible change in HTML; plain text unchanged).

- **client-referral-request: kind changed from transactional to marketing**, with the reason line "You are receiving this because you have worked with Vitalos." The email promotes our services (it names the five practice areas) and asks for new business, which is direct marketing under PECR. Transactional email must carry no marketing, so the alternative was to strip the ask, which would leave nothing to send. Owner to confirm the kind (see below).
- **client-thank-you-anniversary**: removed the soft sales ask ("anything you would like us to look at") so the email matches its own description ("with no sales ask") and stays transactional; removed "your team's openness and clear decisions made it better", a claim about the client the template cannot know; subject no longer ends in `{{first_name}}` (the fallback made it "A note of thanks, there").
- **client-feedback-survey**: preheader no longer claims the survey "takes a few minutes".
- **Testimonial, renewal, offboarding**: tightened only. Offboarding's button is now "Review the offboarding plan", matching "Please review it".
- Kinds kept as transactional: feedback survey (research, no promotion), testimonial request (asks for permission and content, does not promote to the recipient), renewal reminder and offboarding (about an existing contract), anniversary thanks (after the change above).

## Marketing

Order now: heading, opening text (greeting first), key facts (badge, items or details), button, closing text, signature. The announcement keeps its badge directly under the heading, where it labels the news; moving it below the opening text would put it between the text and the button.

- **Reason lines.** Four of five said the person "subscribed to Vitalos updates at vitalos.co.uk". There is no sign-up form for updates on vitalos.co.uk (checked `apps/web`: the only "newsletter" reference is a UTM source in a contact-form test), so that was not true. They now say the person "agreed to receive email updates (or event invitations) from Vitalos", which describes the consent marketing email needs without naming a form that does not exist. The event reminder's reason ("you registered for {{event_name}}") was already accurate. See "Needs approval".
- **Newsletter**: the three stories are now an `items` block (practice tag, title, summary, link to the practice page on vitalos.co.uk: `/what-we-do/consulting`, `/what-we-do/ai-data`, `/what-we-do/managed-services`, all live routes in `apps/web`). One primary button remains ("Visit vitalos.co.uk"). The third story mentions Engineering and Managed Services; it is tagged and linked to Managed Services because it is about looking after live systems.
- **Event invitation**: removed "Registering takes a moment", a claim about a registration page we do not control.
- **Event reminder and seasonal thanks**: headings no longer use `{{first_name}}` ("See you soon, there" and "Thank you, there" with the fallback); the greeting is in the opening text instead, as in the rest of the category.
- **Announcement**: "The page below" is now "The linked page" (in plain text the link is not below); button "Find out more" is now "Read the details".

## Moved emails

Kept as required: every fact, link and expiry ("30 minutes, works once"), the "If this was not you…" line, the enquiry settings notice (unchanged, word for word), all subjects, and the header labels "Enquiries", "Account" and "Careers". Plain text was read for each one in the gallery.

- **`link_fallback`**: "open this link" is now "copy this link into your browser". The URL sits in a muted text block, which our HTML does not make a link, so copying is the instruction that always works.
- **Enquiry alert (one update)**: button "Open enquiry" is now "Open the enquiry" ("open enquiry" also reads as a status). Matches "Open the inbox".
- **Enquiry digest**: heading "Enquiries digest, 27 October 2026" is now "Daily enquiries digest, 27 October 2026". The old digest opened with "Your daily summary of enquiry activity."; the move dropped that line, and with it the fact that the digest is daily. The subject is unchanged.
- **Careers hiring alert**: button "Open applications" is now "Review applications" (same ambiguity); preheader tightened; footer notice no longer says "on the careers notification list", which was untrue for super admins who get the alert by default, and now says where to change it (Careers › Settings, the "Who hears about new applications" field).
- **Password link**: no change. It reads well; the details row "Link expires: 30 minutes, works once" was kept because the expiry wording is fixed.
- **Inbox reply** (`reply_document`): no copy of its own (body and signature come from the person and the inbox settings).

## DRAFT — needs approval

No template copy now contains `DRAFT — needs approval`: every claim that lacked a source was removed rather than replaced. These points need an owner decision:

1. **How marketing consent is collected.** The reason lines now say the person "agreed to receive email updates from Vitalos". That is true only if every list these templates go to holds people who opted in (or, for clients, were given the soft opt-in and an opt-out when their details were collected). If a sign-up form is added to vitalos.co.uk, the line can name it again.
2. **Referral request as marketing.** Confirm the kind change. Practical effect: it now carries the reason line, the unsubscribe link and `List-Unsubscribe`, and honours unsubscribes.
3. **Seasonal thanks reason line** covers two groups ("worked with Vitalos or agreed to receive our email updates"). Fine if both groups are sent the same email; if only clients are sent it, shorten to the first half.

## Retirement candidates

None. The 11 templates each have a distinct purpose. The event invitation and reminder are a pair, not duplicates.

## Variables I would add (not added to `variables.py`)

- **`survey_link`** for the feedback survey and **`booking_link`** for the renewal review. Both use `{{action_link}}`, whose fallback is the contact page; that works, but a named variable makes the editor's sample clearer.
- **A first-name fallback that works outside a greeting.** `first_name` falls back to "there", which only reads well after "Hi". I removed it from subjects and headings in my two categories; the offboarding heading "Thank you, {{first_name}}" stays, because it only goes to a named client contact. Other categories use the same pattern (for example sales "Thank you, {{first_name}}") and the other reviewers may want to know.
- **`offer` and `service` fallbacks** ("our offers", "our services") make the announcement read "our offers is now available as part of our services" if both are empty. A send should always set them; the editor could warn when an announcement has no offer.
- **`renewal_date` fallback** ("the renewal date") makes the subject "Your agreement is due for renewal on the renewal date". Same remedy: warn when it is empty.

## Suggestions not applied

- **Enquiry alert subjects** (unchanged because mail filters match them): "3 enquiry updates" could become "Enquiries: 3 updates" so that every enquiry email starts with the same word and one filter catches all of them ("Enquiries digest: …" already does). Only with notice to the team, since existing filters on "enquiry updates" would stop matching.
- **Enquiry alert (one update), structure**: the badge (sender and channel) repeats the From and Channel rows below it, and the Reference row repeats the heading. Dropping the badge, or the two rows, would shorten the email; that is a structure change, out of my scope.
- **Enquiry digest, structure**: a one-line intro ("Your daily summary of enquiry activity.") would restore the old opening in full; it needs a new block. The digest and the several-updates alert also share one preheader ("Updates on VIT-0001, …"), which is fine.
- **Password link, structure**: the expiry row would read better above the button, so the reader sees the time limit before acting.
- **Plain text of every system email** shows the URL twice: once after the button label and once in the fallback line. The fallback line could be left out of the plain-text part by the renderer. Renderer change, out of scope.
- **Event reminder kind**: a reminder about an event the person registered for, with no promotion, could be transactional (a service message). Kept as marketing: the event itself is a marketing event, and keeping the opt-out is the safe side. Revisit if unsubscribes start stopping people from getting joining details.
- **Gallery footer**: in the local gallery (test settings, `APP_BASE_URL` on `http://localhost`) the unsubscribe line shows the reply-to-unsubscribe fallback instead of a link, before and after my changes. With an `https:` base URL it renders a link, as in the committed contact sheets. Not a template problem.
