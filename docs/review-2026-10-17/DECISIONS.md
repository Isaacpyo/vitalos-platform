# Decisions — 17 October 2026 review run

Every decision taken during the overnight run, with the reason. Decisions 1–7 were made by Temitope before the run (prompt section 0.3); later entries were taken by the orchestrator or a workstream agent.

## Made before the run

1. **Six practices.** Consulting, Engineering, AI & Data, Experience, Managed Services, Labs. Every "five practices" count, list, footer column, mega-menu column and structured-data entry is corrected to six, with Labs as the sixth (linking to `/labs`). "Five areas" of solutions becomes six. _Reason:_ the brand, the admin's six service lines and the first published Insight all say six.
2. **Nav.** The current header nav (What We Do · Who We Are · Support) stays in production. The locked IA nav (What We Do · Industries · Work · Insights · Labs · About, Trust Centre utility link, Talk to Vitalos CTA) is built as `NEXT_PUBLIC_NAV_VARIANT=ia` and enabled on the preview only. "Work" links to `/labs` and is labelled "Labs" while no Work route exists; nothing links to a 404.
3. **Podcast.** No episodes exist. `PODCAST_ENABLED=false` removes the footer column, the route (404) and the sitemap entry; the code stays.
4. **Imagery.** Off-brand imagery is replaced with brand-system artwork, never generated photos or stock. The AI-generated cityscape hero background is retired.
5. **Analytics.** Privacy-first, cookie-free analytics, behind `NEXT_PUBLIC_ANALYTICS_ENABLED` (off in production until approved). Vercel Web Analytics if available at no extra cost; otherwise a self-hosted option is prepared as an approval item.
6. **Contact.** The enquiry mailbox stays `support@vitalos.co.uk`. The IA nav labels it "Contact"; the hero stays "Tell us what you're working on."
7. **Admin identity.** One person = one Django user, who may also be a team member and an Insights author, linked by email, with a required display name.

## Taken during the run

| #   | Area | Decision                                                                                                                                                                         | Reason                                                                                       |
| --- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 8   | Run  | Integration branch `feat/review-2026-10-17` is cut from `origin/main` at `fcc5167` (includes #60, Insights batch 2 import command).                                              | Local `main` was behind; #60 is the import WS3 needs.                                        |
| 9   | Run  | Open PRs #57, #61 and #62 are not folded in; they stay separate and may need a rebase after this PR. Workstreams avoid rewriting the exact lines those PRs touch where they can. | They are someone else's in-flight work and are reviewed on their own.                        |
| 10  | Run  | The PR is left open, not merged, as the run prompt instructs, even though AGENTS.md would allow a self-merge on green.                                                           | The prompt lists merging as an approval item (0.2); it is the more conservative instruction. |
