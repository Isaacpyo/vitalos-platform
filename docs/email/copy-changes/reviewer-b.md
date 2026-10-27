# Copy changes: reviewer (b), service, delivery and finance

Library review of October 2026 (`docs/email/REVIEW.md`). One row per change. Long passages are shortened with "…"; the full text is in the seed files (`superadmin/apps/email_templates/seed/{service,delivery,finance}.json`). "Moved" means the text is unchanged but now sits in its own block after the button, so every email in the category follows the same order: opening text, key facts, button, closing text, signature.

## Service

| Email (key) | Field | Before | After | Reason |
|---|---|---|---|---|
| service-intro-consulting | header_label | Consulting | Introduction | Same label for the same purpose within the category (and the outreach category's introductions use "Introduction"). The practice is named in the subject and the first line. |
| service-intro-consulting | blocks (text) | Vitalos Consulting exists to help leaders get the direction right first | Vitalos Consulting helps leaders get the direction right first | Tighter; same meaning. |
| service-intro-consulting | blocks (order) | "If {{organisation}} is facing a decision like this, … I will not follow up." at the end of the opening text, before the button | The same sentence as closing text after the button | Category block order. |
| service-intro-engineering | header_label | Engineering | Introduction | Same label for the same purpose. |
| service-intro-engineering | blocks (order, text) | "…I would welcome a short conversation. If not, just let me know and I will not follow up." before the button | Closing text after the button; "just" removed | Category block order; tighter. |
| service-intro-ai-data | header_label | AI & Data | Introduction | Same label for the same purpose. |
| service-intro-ai-data | blocks (order) | "If this is relevant, … I will leave it there." before the button | Closing text after the button | Category block order. |
| service-intro-experience | header_label | Experience | Introduction | Same label for the same purpose. |
| service-intro-experience | blocks (order, text) | "…I would welcome a short conversation. If not, just let me know and I will not follow up." before the button | Closing text after the button; "just" removed | Category block order; tighter. |
| service-intro-managed-services | header_label | Managed Services | Introduction | Same label for the same purpose. |
| service-intro-managed-services | blocks (order, text) | "If ongoing support is a concern … If not, just let me know and I will not follow up." before the button | Closing text after the button; "just" removed | Category block order; tighter. |
| service-case-study-consulting | blocks (closing text) | And if this is not relevant to you, just let me know and I will not send more. | If this is not relevant to you, let me know and I will not send more. | Tighter, calmer; same meaning. |
| service-case-study-engineering | blocks (closing text) | And if this is not relevant to you, just let me know and I will not send more. | If this is not relevant to you, let me know and I will not send more. | As above. |
| service-case-study-ai-data | blocks (closing text) | And if this is not relevant to you, just let me know and I will not send more. | If this is not relevant to you, let me know and I will not send more. | As above. |
| service-case-study-experience | blocks (closing text) | And if this is not relevant to you, just let me know and I will not send more. | If this is not relevant to you, let me know and I will not send more. | As above. |
| service-case-study-managed-services | blocks (closing text) | And if this is not relevant to you, just let me know and I will not send more. | If this is not relevant to you, let me know and I will not send more. | As above. |
| service-follow-up-consulting | blocks (heading, opening) | Heading "Thanks again, {{first_name}}", then "Thank you for your enquiry about Vitalos Consulting. …" | No heading; opening text "Hi {{first_name}},\n\nThank you for your enquiry about Vitalos Consulting. …" | "Thanks again" followed by "Thank you" thanked twice; with the `first_name` fallback the heading read "Thanks again, there". Letter style matches the rest of the category. |
| service-follow-up-consulting | blocks (order) | "There is no need to prepare anything formal. …" at the end of the questions, before the details | Closing text after the button | Category block order. |
| service-follow-up-engineering | blocks (heading, opening) | Heading "Thanks again, {{first_name}}", then "Thank you for your enquiry …" | No heading; "Hi {{first_name}}," opening | As for Consulting. |
| service-follow-up-engineering | blocks (order) | "If it later makes sense to look at code or systems, … never ask for passwords by email." before the details | Closing text after the button | Category block order. |
| service-follow-up-ai-data | blocks (heading, opening) | Heading "Thanks again, {{first_name}}", then "Thank you for your enquiry …" | No heading; "Hi {{first_name}}," opening | As for Consulting. |
| service-follow-up-ai-data | blocks (order) | "Please do not send personal or sensitive data by email. …" before the details | Closing text after the button | Category block order. |
| service-follow-up-experience | blocks (heading, opening) | Heading "Thanks again, {{first_name}}", then "Thank you for your enquiry …" | No heading; "Hi {{first_name}}," opening | As for Consulting. |
| service-follow-up-experience | blocks (order) | "There is no need to prepare anything formal. …" before the details | Closing text after the button | Category block order. |
| service-follow-up-managed-services | blocks (heading, opening) | Heading "Thanks again, {{first_name}}", then "Thank you for your enquiry …" | No heading; "Hi {{first_name}}," opening | As for Consulting. |
| service-follow-up-managed-services | blocks (order) | "If access is needed later, … never ask for passwords by email." before the details | Closing text after the button | Category block order. |

## Delivery

| Email (key) | Field | Before | After | Reason |
|---|---|---|---|---|
| client-welcome | subject | Welcome to Vitalos, {{first_name}} | Welcome to Vitalos | With the fallback the subject read "Welcome to Vitalos, there". The greeting stays in the body ("Hi {{first_name}},"). |
| client-welcome | blocks (heading) | Heading "Glad to be working with you" | Removed | Letter style, as in the rest of the category; the body already says "We are pleased to be working with {{organisation}}". |
| client-welcome | blocks (steps) | "Over the next few days we will:\n- propose a time for the kickoff meeting\n- share a short agenda and the information we need from you\n- agree who on each side owns decisions, access and approvals" (bullets in the text) | `steps` block titled "Over the next few days": "We propose a time for the kickoff meeting." / "We share a short agenda and the information we need from you." / "Together we agree who on each side owns decisions, access and approvals." | The three things happen in order; a numbered `steps` block shows that. Same content. |
| client-welcome | blocks (order) | "I will be your main point of contact. …" in the opening text, before the details | Closing text after the details | Category block order. |
| kickoff-meeting-scheduling | blocks (heading) | Heading "Let us find a time, {{first_name}}" | Removed; opening "Hi {{first_name}}," | Letter style; the heading read "Let us find a time, there" with the fallback. |
| kickoff-meeting-scheduling | blocks (text) | "The next step for {{project_name}} is a kickoff meeting. It is where we confirm scope, … so it helps to have the people … in the room." | "The next step for {{project_name}} is a kickoff meeting, where we confirm scope, … It helps to have the people … in the room." | Tighter; same meaning. |
| kickoff-meeting-scheduling | blocks (text, order) | "Please choose a time that suits your key stakeholders using the link below. If none of the available times work, reply with a few options and we will fit around you." | Opening ends "Please choose a time that suits your key stakeholders."; "If none of the available times work, …" is closing text after the button | Category block order; "using the link below" is redundant next to the button. |
| kickoff-agenda-and-preparation | blocks (steps) | "Here is what we plan to cover:\n- goals, scope and … for {{organisation}}\n- roles, …\n- timeline, …\n- risks, …" (bullets) | Opening ends "Here is what we plan to cover."; `steps` block titled "Agenda" with the same four items | An agenda is ordered; the numbered block makes it scannable. Same items. |
| kickoff-agenda-and-preparation | blocks (order) | "Do not worry if some of this is not ready. …" before the details | Closing text after the button | Category block order. |
| system-access-request | blocks (order) | One text block before the button, ending with the credentials warning and "Could you also tell us who at {{organisation}} approves access, …?" | Opening (what we need and how to grant it) before the button; the approver question and the credentials warning after it | Category block order: the ask before the button, the follow-on points after. |
| system-access-request | blocks (button) | Review access request | Review the access request | Consistent verb-phrase labels ("View the plan", "Open the test pack"). |
| project-plan-shared | blocks (details) | Link available until: {{link_expiry}} | Link expires: {{link_expiry}} | The value is written as "in 7 days" (and that is the fallback), which read "Link available until in 7 days". "Link expires" reads well with a date or a duration. |
| project-plan-shared | blocks (order) | "Please review it with your team … is all we need." before the details | Closing text after the button | Category block order. |
| project-status-update | subject | {{project_name}}: status update | Status update: {{project_name}} | With the fallback the subject began with a lower-case letter ("your project: status update"). |
| milestone-completed | blocks (heading) | Heading "Good progress, {{first_name}}" | Removed; opening "Hi {{first_name}}," | Letter style; "Good progress, there" with the fallback. |
| milestone-completed | blocks (text, order) | "…Please take a look and let us know if anything needs clarifying.\n\nNext, we will move on to:\n\n{{next_steps}}" | Opening: completion, thanks, "Next, we will move on to: {{next_steps}}", then "A summary … is in the linked document."; after the button: "Please take a look and let us know if anything needs clarifying." | Category block order: the request to look sits after the link it refers to. |
| change-request-raised | blocks (text, order) | "No work on the change will start until you approve it in writing. Please review it and let us know your decision, or reply with a time to talk it through." before the details | Closing text after the button: "No work on the change will start until you approve it in writing. Please let us know your decision, or reply with a time to talk it through." | Category block order; "review it" repeats the button. |
| change-request-approved | blocks (heading) | Heading "Thanks, {{first_name}}" | Removed; opening "Hi {{first_name}}," | Letter style; "Thanks, there" with the fallback. |
| change-request-approved | blocks (order) | "You will see the change reflected … straight away." before the details | Closing text after the button | Category block order. |
| change-request-approved | blocks (button) | View updated plan | View the updated plan | Consistent verb-phrase labels. |
| uat-sign-off-request | blocks (text) | "{{milestone_name}} for {{project_name}} is ready for user acceptance testing." | "The work for {{milestone_name}} on {{project_name}} is ready for user acceptance testing." | The sentence began with a variable; with the fallback it read "this milestone for your project is ready…" (lower-case start). |
| uat-sign-off-request | blocks (text, order) | "Please complete testing and confirm sign-off by the date below. If you find issues, …" before the details | Closing text after the button: "Please complete testing and confirm sign-off by {{due_date}}. If you find issues, …" | Category block order; "the date below" no longer points anywhere once the text follows the details, so the date is named. |
| go-live-announcement | subject | {{project_name}} is live | Now live: {{project_name}} | With the fallback the subject began with a lower-case letter ("your project is live"). |
| go-live-announcement | blocks (heading, text) | Heading "Congratulations, {{first_name}}!", then "{{project_name}} is now live. …" | No heading; "Hi {{first_name}},\n\nCongratulations: {{project_name}} is now live. …" | No exclamation marks (review finding); letter style; avoids "Congratulations, there". |
| project-handover-and-close | blocks (order) | "Please review it and confirm … in line with your own access policies." before the button | Closing text after the button | Category block order. |
| project-handover-and-close | blocks (button) | Open handover pack | Open the handover pack | Consistent verb-phrase labels. |
| support-and-maintenance-offer | kind | transactional | outreach | It offers a further paid service, which is direct marketing under PECR even to an existing client (soft opt-in still needs an opt-out in every message). Outreach adds the reason line and the unsubscribe footer. |
| support-and-maintenance-offer | reason | (none) | We are contacting you because {{organisation}} has worked with us on {{project_name}}, and ongoing support may be useful. You can opt out at any time. | Required for outreach; follows the wording of the other reason lines. |
| support-and-maintenance-offer | blocks (order) | "There is no obligation. …" before the button | Closing text after the button | Category block order. |

## Finance

| Email (key) | Field | Before | After | Reason |
|---|---|---|---|---|
| quote-sent | blocks (text) | "It sets out what is included, the assumptions it rests on and what is out of scope, so there are no surprises later. It also states how long the quote remains valid." | "It sets out what is included, the assumptions it rests on, what is out of scope and how long it remains valid, so there are no surprises later." | One sentence instead of two; same content. |
| quote-sent | blocks (order) | "If the scope or any assumption does not match … if that is easier." before the details | Closing text after the button | Category block order. |
| invoice-sent | blocks (text) | Please find our invoice for {{project_name}} at the link below. | Please find invoice {{invoice_number}} for {{project_name}} at the link below. | The invoice number moves from the details table into the opening line, so it stays in the body. |
| invoice-sent | blocks (key facts) | details: Invoice / Amount / Due date | stats: Amount / Due date | The amount and due date are what the reader needs at a glance; the number is in the subject and opening line. |
| invoice-sent | blocks (text) | …please check with {{sender_name}} through a contact route you already know… | …please check with us through a contact route you already know… | With the fallback this read "check with The Vitalos team" (capital T mid-sentence); "us" covers any sender. |
| invoice-sent | blocks (order) | Purchase-order and bank-details paragraphs before the details | Closing text after the button | Category block order. |
| invoice-sent | blocks (button) | View invoice | View the invoice | Consistent with "View the quote". |
| payment-reminder-friendly | preheader | Due on {{due_date}}. Please ignore this if payment is already on its way. | The amount and due date are below. Please ignore this if payment is already on its way. | With the fallback the preheader read "Due on the due date." |
| payment-reminder-friendly | blocks (text) | A gentle reminder that invoice {{invoice_number}} for {{amount}} is due on {{due_date}}. | A gentle reminder that invoice {{invoice_number}} is due on {{due_date}}. | The amount is now shown in the stats block. |
| payment-reminder-friendly | blocks (key facts) | details: Invoice / Amount / Due date | stats: Amount / Due date | As for invoice-sent. |
| payment-reminder-friendly | blocks (order) | "If anything is holding it up, …" before the details | Closing text after the button | Category block order. |
| payment-reminder-friendly | blocks (button) | View invoice | View the invoice | Consistent labels. |
| payment-reminder-overdue | blocks (text) | "Our records show that invoice {{invoice_number}} for {{amount}}, due on {{due_date}}, has not yet been paid. It is now {{days_overdue}} days overdue. … Otherwise, we would be grateful if you could arrange payment as soon as possible." | "Our records show that invoice {{invoice_number}}, due on {{due_date}}, has not yet been paid. It is now {{days_overdue}} days overdue, and we would be grateful if you could arrange payment as soon as possible." | The request leads instead of trailing after the exceptions; the amount is in the stats block. |
| payment-reminder-overdue | blocks (key facts) | details: Invoice / Amount / Due date / Days overdue | stats: Amount / Status "Overdue" | The status, written as a word, is the news; the due date and days overdue stay in the opening sentence (a "Days overdue: a few" cell read badly with the fallback). |
| payment-reminder-overdue | blocks (order) | "If you have paid in the last few days, … work through it with you." before the details | Closing text after the button | Category block order. |
| payment-reminder-overdue | blocks (button) | View invoice | View the invoice | Consistent labels. |
| payment-reminder-final-notice | blocks (text) | "…invoice {{invoice_number}} for {{amount}} remains unpaid. … Please arrange payment, or reply to let us know when it will be made…" | "…invoice {{invoice_number}} remains unpaid. … Please arrange payment, or reply to tell us when it will be made…" | The amount is in the stats block; tighter. |
| payment-reminder-final-notice | blocks (key facts) | details: Invoice / Amount / Due date / Days overdue | stats: Amount / Status "Overdue" | As for the overdue reminder. |
| payment-reminder-final-notice | blocks (order) | "If we do not hear from you, we may need to pause work and refer the matter on." before the details | Closing text after the button | Category block order. |
| payment-reminder-final-notice | blocks (button) | View invoice | View the invoice | Consistent labels. |
| payment-received-receipt | blocks (heading) | Heading "Thank you, {{first_name}}" | Removed; opening "Hi {{first_name}}," | Letter style like the rest of the category; "Thank you, there" with the fallback. The thanks stays in the body ("Thank you for settling it."). |
| payment-received-receipt | blocks (order) | "Please keep this email for your records. …" before the details | Closing text after the details | Category block order. |
