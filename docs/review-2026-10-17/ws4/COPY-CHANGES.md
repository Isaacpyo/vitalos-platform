# WS4 public copy changes

All on role pages (`/careers/{slug}`). The settings drafts in `../CAREERS-SETTINGS-DRAFT.md` are not published, so they are not listed here.

| Page / place | Before | After | Source |
|---|---|---|---|
| Role page, end of article: new "About Vitalos" strip, heading | (none) | About Vitalos | `navLabels.about` + `brandName` (`packages/cms/src/locked-copy.ts`) |
| Same strip, lead | (none) | We help ambitious organisations modernise operations, build digital products and adopt AI. | `propositionLong` (locked copy; Stage 0 §0, owner-approved) |
| Same strip, practices line | (none) | Vitalos works through six practices: Consulting, Engineering, AI & Data, Experience, Managed Services and Labs. | `practiceNames` + `navLabels.labs` (locked copy); DECISIONS.md 1 (six practices including Labs); Master FAQ ABT-01 (Verified) "Vitalos works through … practices", corrected to six per decision 1 |
| Same strip, links | (none) | About Vitalos → `/about`; Explore what we do → `/what-we-do` | `navLabels.about`; `ctas.secondary` (locked copy) |
| Role page, hiring process | plain "How we hire" section (hidden; process empty in production) | the same heading and text in its own panel; still hidden while empty | Careers settings / role `process_md` (no new words) |
| Application form, CV picker after a file is chosen | Choose a file | Choose a different file | New UI label (describes the control; makes no claim) |
| Application form, CV picker (screen readers only) | (none) | "{file name} chosen." | New UI status text (describes the control; makes no claim) |
| Application form, field errors | "Enter your name" etc. | "Error: Enter your name" (the "Error:" is visually hidden; same as the contact form) | Shared `Field` primitive (`packages/ui`) |
| Confirmation after applying, new heading | (none) | What happens next | New UI heading (no claim) |
| Confirmation, line 1 | (none) | We assess every application on the skills, experience and potential it shows for the role. | Live equal-opportunities statement (Careers settings, live on vitalos.co.uk/careers, 17 Oct 2026) |
| Confirmation, line 2 | (none) | We use your application to assess it and to contact you about it, as described in the candidate privacy notice. | Candidate privacy notice, "Why we use it" (`packages/cms/src/repo/legal.ts`, owner-approved 16 Oct 2026) |
| Confirmation, line 3 (only when a contact address is set) | (none) | You can withdraw your application at any time and we will delete it. Email support@vitalos.co.uk. | Candidate privacy notice, "Your rights" (same file); the address comes from site settings |
| Confirmation, hiring process | shown when set | moved under "What happens next" | unchanged (settings) |
