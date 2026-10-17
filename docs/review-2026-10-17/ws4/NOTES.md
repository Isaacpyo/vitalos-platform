# WS4 notes: Careers content and hygiene (B7)

Branch `review/ws4-careers`; worktree `D:/Development/vitalos-ws4`, moved from C: when C: filled up.

## Shipped

- **Settings drafts**: `../CAREERS-SETTINGS-DRAFT.md`, covering Benefits, Default hiring process, Salary policy and Equal opportunities. Each paragraph has its source, and gaps are marked "GAP: needs owner input". Nothing was saved to production.
- **Roles review**: `../CAREERS-DRAFTS-REVIEW.md`.
  - The three open roles were checked against their public pages.
  - Only two share £70,000–£85,000. AI & Data Engineer is £65,000–£80,000.
  - The evidence that would confirm each band is listed.
  - The seven-drafts review is a follow-up with a rubric and a read-only shell snippet.
- **Role page** (`apps/web/src/templates/careers/RoleTemplate.tsx`, `parts.tsx`, `features/content/careers/model.ts`):
  - The hiring process is rendered as its own panel (`ProcessBlock`). It shows only when the role's process or the careers default has text.
  - New "About Vitalos" strip at the end. It uses the locked proposition and the practices line built from `@vitalos/cms` exports (six, with Labs), and links to `/about` and `/what-we-do`.
  - `JobPosting` sends `addressCountry: "GB"` for a "United Kingdom" or "UK" location.
- **Application form** (`ApplicationForm.tsx`, `features/content/careers/form.ts`):
  - Built on the shared `@vitalos/ui` controls, so it matches the contact form.
  - Styled CV picker, with a "Choose a different file" label once a file is chosen and a screen-reader status line.
  - Inline validation on blur, with errors tied by `aria-describedby` and `aria-invalid`.
  - Error summary from `FormErrorSummary`.
  - The confirmation has "What happens next", worded from approved copy and promising no email.
- **Tests**:
  - Unit: `model.test.ts` covers the process split, the practices line and the JSON-LD country; `pages.test.tsx` covers the process block hidden or shown, its order, and the About strip.
  - E2E: `tests/content/careers.spec.ts` covers the About strip, no process block on the fixture, "what happens next" with no email promise, and inline validation. `tests/content/careers.a11y.spec.ts` runs axe at 1440 and 390 on careers, role, closed role, form errors and confirmation.

## Follow-ups

1. **Draft roles (7)**: the owner runs the snippet in `CAREERS-DRAFTS-REVIEW.md` part B and fills in the verdicts. Until then the drafts stay drafts.
2. **Salary bands**: the owner confirms the two Senior roles' shared band was deliberate. Check for a `careers.role_duplicated` audit event and the revision history.
3. **Hybrid location**: the owner decides whether the Senior Technology Consultant should name a base for in-person time.
4. **Settings**: paste the approved hiring-process text first. Benefits and Salary policy wait for owner input.
5. **Coordination with WS2**: if WS2 adds a six-practices export to `locked-copy.ts`, swap `practicesLine()` for it. If WS2 renames "Labs" in `practiceNames`, for example to "Vitalos Labs", check that the deduplication still gives six.
6. `tests/content` is still not wired into CI (see its config header). The axe runs at 390 and 1440 were run by hand; results are in the report.
