# Email decisions

Decisions for the email audit of October 2026 (`docs/email/REPORT.md`). Architecture decisions are in ADR-030 (layout), ADR-046 (automated inbound mail) and the ADRs of each other repository.

| # | Date | Decision | Why |
|---|---|---|---|
| E1 | 27 Oct 2026 | **Scope**: every email sent as Vitalos or a Vitalos product from a `vitalos.co.uk` address, in this repository and every other repository that sends such email. Out of scope and only listed: separately branded products (Fauward, SOB Autofix, TipSignal), email sent under a customer's brand, and third-party senders (cal.com, Google, Microsoft). | Owner brief, decision 0.3.1. |
| E2 | 27 Oct 2026 | **Askbridge uses the Vitalos layout**: header label "Askbridge"; footer product line "Askbridge by Vitalos" above the company facts; its own why-you-got-this line. Its separate `ab-` email design is removed; the hosted lock-up image stays for other uses. | Owner brief, decision 0.3.2: one system. |
| E3 | 27 Oct 2026 | **One layout everywhere**: TypeScript renders with `@vitalos/email-layout` or a vendored copy pinned to a `vitalos-platform` commit; Python with `apps/mailer/layout.py` or a port that passes the golden fixtures. | Owner brief, decision 0.3.3; ADR-030. |
| E4 | 27 Oct 2026 | **New blocks** `code`, `steps`, `items`, `stats` and **correspondence mode**, using only existing colour roles. The shell gained a `[[card_edge]]` slot so correspondence has rounded corners without the header; existing fixtures are byte-identical. | The gaps (alerts, digests, password and verification emails, inbox replies) need them. ADR-030 status note of 27 October 2026. |
| E5 | 27 Oct 2026 | A verification code never appears in the subject or preheader: both renderers refuse such a document, and the editor refuses to save it. | Subjects and preheaders show on lock screens and in notification previews. |
| E6 | 27 Oct 2026 | Correspondence mode allows only text, quote, divider and signature blocks, and the renderers refuse anything else. Inbox replies use the inbox signature as a text block, not the signature block, so the sign-off is not doubled. | A reply is a letter, not a notification. |
| E7 | 27 Oct 2026 | The Askbridge repository is `vitalos-technologies/askbridge`, not `relay` (no `relay` repository exists for either owner). It matched all four checks: sender `no-reply@askbridge.vitalos.co.uk`, `ab-card`/`ab-eyebrow`/`ab-btn-link`, `brand/email/askbridge-lockup-reversed@2x.png` and the subject "was also verified in another Askbridge workspace". | Brief section 1.2: confirm by contents. |
| E8 | 27 Oct 2026 | Work is on the session branch `claude/tender-cray-6ipewn` in this repository rather than `feat/email-audit`. | The environment pins the branch name. |
