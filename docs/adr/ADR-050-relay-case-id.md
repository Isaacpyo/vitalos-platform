# ADR 050 Relay case ID

Status: Accepted (engineering, 20 October 2026).

## Context

When Relay passes a conversation to a person, the visitor gets no reference to quote if they write or call about it later. Staff can only find the conversation by name, email or message text, and a visitor who left no contact details cannot be found at all.

## Decision

1. **One case ID per conversation**, stored in `relay.conversations.case_id`. It is 15 digits: the Unix time in seconds, then five random digits (for example `179249323700172`). A partial unique index and a format check guard it.
2. **Created when a person is first involved**: when the visitor asks for a person (`POST /api/relay/handoff`), or when a member of staff joins a conversation nobody requested. After that it never changes. The store sets it only while it is empty (`update … where case_id is null`), so a double submit cannot change an ID the visitor has already seen. If the ID collides with another conversation, a new one is drawn, up to five times.
3. **Shown to the visitor**: on the "Request sent" card, with a copy button, and in a strip under the widget header. It also appears in the reply email, when visitor emails are on.
4. **Shown to staff**: in the thread header (with a copy button), the context panel, the transcript header, and the hand-off, reminder and visitor-replied alert emails. Inbox search matches it.
5. **A reference, not a credential.** Knowing a case ID gives no access. Visitors still authenticate with their bearer token, and staff still sign in to the Super Admin. There is no lookup by case ID on the public API. The case ID is deleted with its conversation (retention or a delete).

## Options

- **Show the conversation UUID**: rejected. It is too long to read out, and it is the key behind the visitor API.
- **A sequence (`000123`)**: rejected. It reveals the hand-off volume and lets anyone guess neighbouring IDs.
- **One ID per hand-off**: rejected. A visitor who asks twice in one conversation would get two references for the same thread.

## Consequences

Additive migration `20261020090000_relay_case_id.sql`: a nullable column, an index, a backfill for existing hand-offs, and `inbox_list` replaced in place with the same signature, so its grants are kept. The `caseId` field is added to the visitor and admin API responses and to the webhook events (docs/relay/API.md). Older events without it show "Not recorded" in alert emails.
