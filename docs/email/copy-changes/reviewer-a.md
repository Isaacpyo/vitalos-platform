# Copy changes: reviewer (a)

Categories: enquiries, internal, sales, outreach (`superadmin/apps/email_templates/seed/{enquiries,internal,sales,outreach}.json`). One row per change. Long text blocks show only the sentence that changed. The review notes are in `docs/email/review/reviewer-a.md`.

## Enquiries

| Email (key) | Field | Before | After | Reason |
|---|---|---|---|---|
| enquiry-acknowledgement | description | Sent to the enquirer straight after they submit the website form, confirming receipt and explaining what happens next. | For the enquirer after they submit the website form, confirming receipt and explaining what happens next. | Nothing sends it automatically. The website holds customer acknowledgements until the owner approves them (`apps/web/.../email-notifier.ts`). |
| enquiry-acknowledgement | blocks (opening text) | Thank you for getting in touch with Vitalos. Your enquiry has reached us, and a senior member of the team will read it properly before replying, rather than sending you a standard pack. | Thank you for getting in touch with Vitalos. A senior member of the team will read your enquiry properly before replying, rather than sending you a standard pack. | Shorter. "Has reached us" repeats the subject. |
| enquiry-acknowledgement | blocks (what happens next) | Bullet list in the text: "What happens next: - We review what you have shared … - We reply shortly, either with a few clarifying questions or a suggested time to talk. - If a conversation makes sense …" | New `steps` block "What happens next": 1. We read what you have shared and think about where we could genuinely help. 2. We reply with a few clarifying questions or a suggested time to talk. 3. If a conversation makes sense, the first call is about understanding your situation, not selling to you. | The three points are a sequence, so they use the steps block. "Shortly" is removed because it is a response-time promise with no source. |
| enquiry-acknowledgement | blocks (closing text and order) | Text before the button: "If you would rather pick a time to talk now, you are welcome to book a call. Otherwise, simply reply to this email and quote your reference if anything changes in the meantime." | Button first, then: "You are welcome to book a call now rather than wait for our reply. If anything changes in the meantime, reply to this email and quote your reference." | Category block order (key facts, button, closing text). Tighter wording. |
| meeting-booked-confirmation | header_label | Meeting booked | Call booked | One family of labels for the call emails ("Call booked", "Call reminder", "Call rescheduled", "Call cancelled", "Missed call"). The copy calls it a call throughout. |
| meeting-booked-confirmation | blocks (opening text) | … it is worth adding them to your calendar … / - Feel free to invite colleagues … | … add them to your calendar … / - Invite colleagues … | Tighter, same meaning. |
| meeting-booked-confirmation | blocks (second button) | Button "Choose another time" → `{{reschedule_link}}` | Details row "Change the time" → `{{reschedule_link}}` (a link) | One primary button at most. Joining stays primary; rescheduling is still one click. |
| meeting-booked-confirmation | blocks (closing text) | If the time no longer works, you can choose another slot whenever suits you. | If the time no longer works, choose another with the link above or reply to this email. | Points to the new link row, and adds the reply route the other call emails offer. |
| meeting-reminder-24-hours | description | Sent automatically 24 hours before a booked call as a reminder with the joining link. | Reminder to send 24 hours before a booked call, with the joining link. | Nothing sends it automatically (no scheduler uses this key). |
| meeting-reminder-24-hours | header_label | Reminder | Call reminder | Same label as the 1-hour reminder (same purpose), and part of the call family. |
| meeting-reminder-24-hours | blocks (opening text) | If you have a spare moment beforehand, it helps to think about what a good outcome would look like … | If you have a moment beforehand, think about what a good outcome would look like … | Tighter. |
| meeting-reminder-24-hours | blocks (second button) | Button "Choose another time" → `{{reschedule_link}}` | Details row "Change the time" → `{{reschedule_link}}` (a link) | One primary button at most. |
| meeting-reminder-24-hours | blocks (closing text) | Choose a new time, or simply reply to this email and we will sort it out. | Choose a new time with the link above, or reply to this email and we will sort it out. | Points to the link row. "Simply" removed. |
| meeting-reminder-1-hour | description | Sent automatically one hour before a booked call with the joining link. | Reminder to send one hour before a booked call, with the joining link. | Nothing sends it automatically. |
| meeting-reminder-1-hour | header_label | Starting soon | Call reminder | Same purpose as the 24-hour reminder, so the same label. |
| meeting-reminder-1-hour | blocks (opening text) | Our call starts in about an hour. You can join using the button below whenever you are ready. | Our call starts in about an hour. The joining link is below. | Shorter. Also reads correctly in plain text, which has no button. |
| meeting-reminder-1-hour | blocks (closing text) | Running late, or something urgent has come up? Just reply to this email and we will adjust. | Running late, or has something urgent come up? Reply to this email and we will adjust. | Grammar (parallel question). "Just" removed. |
| meeting-rescheduled | header_label | Rescheduled | Call rescheduled | Call label family. |
| meeting-rescheduled | blocks (text) | Our call has moved, and the updated details are below. | Our call has moved; the updated details are below. | Tighter. |
| meeting-cancelled | header_label | Cancelled | Call cancelled | Call label family. |
| meeting-cancelled | blocks (text) | If you would still like to talk, you are welcome to book a new time whenever it suits you. | If you would still like to talk, book a new time whenever it suits you. | Tighter. |
| missed-meeting-follow-up | subject | Sorry we missed each other, {{first_name}} | Sorry we missed each other | With the fallback it read "Sorry we missed each other, there". |
| missed-meeting-follow-up | blocks (heading) | (none) | Heading: Let us find another time | Every other email in the category opens with a heading. |
| missed-meeting-follow-up | blocks (text) | We were set up to speak … choose a time that suits you below … a quick reply saying so is perfectly fine … | We were due to speak … choose a new time below … a quick reply saying so is fine … | Plainer wording. Matches the button "Choose a new time". |
| user-invite | subject | You are invited to your Vitalos account | You have been invited to a Vitalos account | "Invited to your account" did not make sense. The account is new to the recipient. |
| user-invite | blocks (text) | Use the button below to accept the invitation and set up your sign-in. | Accept the invitation to set up your sign-in. | Shorter. Reads correctly in plain text. |

## Internal

| Email (key) | Field | Before | After | Reason |
|---|---|---|---|---|
| internal-new-lead-assigned | blocks (button label) | Open lead | Open the lead | Verb-phrase labels with the article, as in the rest of the library ("Read the proposal", "Open the questionnaire"). |
| internal-proposal-activity | blocks (button label) | Open record | Open the record | Same as above. |
| internal-payment-received | blocks (button label) | Open invoice | Open the invoice | Same as above. |
| internal-task-due | blocks (button label) | Open task | Open the task | Same as above. |

## Sales

| Email (key) | Field | Before | After | Reason |
|---|---|---|---|---|
| new-lead-first-response | subject | Your enquiry: a few thoughts and next steps | Your enquiry: a suggested next step | The email gives one next step (a call) and no "thoughts". The subject now says what is inside. |
| new-lead-first-response | preheader | A personal reply from {{sender_name}}, with a suggested way forward. | A personal reply to what you shared about {{organisation}}. | With the fallback it read "A personal reply from The Vitalos team", which is not personal and has a capital mid-sentence. The new preheader adds to the subject instead of repeating "next step". |
| discovery-call-invite | blocks (text) | - the business problem … / - the systems … / - constraints … / - what a sensible first step … / Please choose a time that suits you. | - The business problem … / - The systems … / - Constraints … / - What a sensible first step … / Choose a time that suits you below. | Bullets in sentence case, like the rest of the category. The closing sentence now leads into the button. |
| nda-request | blocks (text) | that is absolutely fine; | that is fine; | Calmer. |
| proposal-sent | blocks (text) | - our understanding … / - the approach … / - scope, phasing … / - commercials … | - Our understanding … / - The approach … / - Scope, phasing … / - Commercials … | Bullets in sentence case, like the rest of the category. |
| proposal-accepted-thank-you | header_label | Thank you | Proposal accepted | "Thank you" was also the label for closed-lost, which has a different purpose. |
| proposal-accepted-thank-you | blocks (heading) | Heading: Thank you, {{first_name}} | (removed) Text opens "Hi {{first_name}}," | Category block order: 12 of 14 sales emails are letters with no heading. The heading also repeated the opening "Thank you". |
| proposal-accepted-thank-you | blocks (what happens next) | Bullet list in the text: "What happens next: - We will send the contract … - Once signed … - Before kick-off …" | `steps` block "What happens next" with the same three items, unchanged | A sequence, so the steps block. |
| proposal-accepted-thank-you | blocks (closing text) | … so just reply here if anything comes up. We are looking forward to getting started! | … so reply here if anything comes up. We look forward to getting started. | No exclamation marks (review finding). "Just" removed. |
| contract-signed-confirmation | header_label | Signed | Contract signed | Clearer on its own. Pairs with "For signature". |
| contract-signed-confirmation | blocks (heading) | Heading: We are ready to begin | (removed). The sentence "we are ready to begin" moves into the text. | Category block order (letters with no heading). Meaning kept. |
| contract-signed-confirmation | blocks (next steps) | "Next steps:" followed by a quote block `{{next_steps}}` | "Next steps:\n\n{{next_steps}}" in the text | A quote block shows someone's own words. Next steps are ours, and `discovery-call-summary` already shows them as text. |

## Outreach

| Email (key) | Field | Before | After | Reason |
|---|---|---|---|---|
| outreach-linkedin-connection-follow-up | blocks (text) | Thank you for accepting my connection on LinkedIn. | Thank you for accepting my connection request on LinkedIn. | Accuracy: a person accepts a connection request. |
