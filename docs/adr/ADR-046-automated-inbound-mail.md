# ADR 046 Automated inbound mail is not an enquiry

Status: Accepted (email audit, 27 October 2026).

## Context

The support mailbox turns every new inbound message into an enquiry, and every enquiry triggers an alert. Machine mail was getting through: Askbridge notifications from `no-reply@askbridge.vitalos.co.uk` (VIT-0002, VIT-0008), cal.com booking emails from `hello@cal.com` (VIT-0003, VIT-0004) and the website's own enquiry notification sent to support@ (VIT-0006). Mail with RFC 3834 headers was already detected, but it was filed as Spam.

The website's enquiry notification is a special case: the website does not post its enquiries to the Super Admin, so that email is the only way a website enquiry reaches the inbox. It is a real person's enquiry relayed by a machine (VIT-0006 is one). Filing it as automated would hide real enquiries; filing it as it arrived made the sender support@ itself, so a reply went to the wrong place.

## Decision

1. Every system email Vitalos sends names itself with `X-Vitalos-Notification: <kind>` (for example `enquiries.update`, `accounts.password-link`, `web.enquiry-notification`, `askbridge.invitation`) and carries `Auto-Submitted: auto-generated`. When an email is about one enquiry it also carries `X-Vitalos-Reference`. A form that forwards a person's message to support@ sends `X-Vitalos-Form: <form>` and puts the person in `Reply-To`.
2. A new inbound message that does not thread onto an existing enquiry is classified (`apps/enquiries/automated.py`) in this order:
   - **Form relay**: from a `vitalos.co.uk` address (any subdomain), with `X-Vitalos-Form` or `X-Vitalos-Notification: web.enquiry-notification`, and one valid `Reply-To` that is neither ours nor a no-reply address. It is filed as an enquiry **from the Reply-To person** (source Website form for the website notification), with the normal alert. If a message with the same `X-Vitalos-Reference` is already filed, the new copy is linked to that enquiry instead.
   - **Own notification**: from a `vitalos.co.uk` address with `X-Vitalos-Notification`. Linked to the enquiry named by `X-Vitalos-Reference` (stored there as an automated message, no alert, no status change); otherwise automated.
   - **Automated**: `Auto-Submitted` other than `no`, the other RFC 3834 and list signs already detected (bounces, `Precedence: bulk`, `List-Id`, `List-Unsubscribe`), a no-reply or mailer-daemon **address**, or a sender on the list in Settings > Email (default `hello@cal.com`, `calendar-notification@google.com`, `notifications@calendly.com`; an `@domain` line covers a whole domain).
   - Otherwise a **person**: a normal enquiry.
3. Automated mail gets a new status, **Automated**, with its own inbox view. It is stored and searchable like any enquiry, has no response target, sends no alert and is left out of "All", the open counts and the template preview data. Spam keeps its own meaning (marked by a person) and retention; Automated is not deleted by any job.
4. Only the address decides "no-reply"; a display name never does, so "No Reply (Alex) <alex@example.com>" is a person. Form headers from outside `vitalos.co.uk` are ignored, so nobody can file mail in someone else's name.
5. Nothing is deleted, dropped or changed retroactively. `manage.py list_automated_enquiries` lists existing enquiries the rules would file differently (references, status and reason only) for a person to tidy.

## Consequences

- Auto-replies and bounces that start no thread now land in Automated, not Spam.
- A spoofed `X-Vitalos-*` header from a non-Vitalos address has no effect. A spoofed `vitalos.co.uk` sender could file a message as automated or as a form relay; SPF, DKIM and DMARC on the domain limit that, and the message is still stored and searchable.
- Every Vitalos product that emails support@ must set the headers in decision 1 (Askbridge does, from the email audit).

## Revisit triggers

The website starts posting enquiries to the Super Admin API (then the website notification should only ever be linked); a sender list that needs per-sender rules; a need to read DMARC results before trusting `vitalos.co.uk` senders.
