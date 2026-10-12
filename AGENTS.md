# Agent instructions

- Inspect relevant files and Git state before broad changes; preserve unrelated work and never reset user work.
- Never expose secrets, invent evidence, clients, outcomes, legal claims, certifications or security approvals.
- Applications cannot import another application's source. Use documented `@vitalos/*` public entrypoints.
- Keep business rules outside UI and route handlers; validate external input and authorize on the server.
- Keep server-only dependencies and secrets out of client bundles. Use provider interfaces/adapters.
- Update ADRs and current/future-state documentation when architecture changes.
- Run scoped tests while developing and all relevant gates before declaring success. A failed criterion is not success.
- Do not deploy production, alter DNS, rotate secrets or delete production data without explicit authorization.
- Editorial content lives in the repo (packages/cms/src/repo, ADR-028); PostgreSQL owns operational records; controlled evidence stays out of the public site.

## Autonomy

- Finish tasks end to end. Do not hand back setup steps you can do yourself; when one step is blocked, do everything around it and report the exact blocker.
- For provider setup prefer CLIs (`gh`, `npx vercel`, `supabase`, `wrangler`, `az`), then Claude in Chrome on dashboards where the user is already signed in.
- You may create development/test/preview API keys, secrets, webhooks and OAuth apps without asking. Write values only to the gitignored `.env.local` or the provider's secret store (e.g. Vercel env for non-production environments). Never print, log, commit or paste secret values; refer to them by variable name, and add new names to `.env.example`.
- Stop and ask only for: login, 2FA or CAPTCHA; anything that costs money or needs payment details; accepting new terms; production keys or production env vars; deleting data; DNS, billing, org or account-security settings.
- Subagents running in worktrees have no browser and no `.env.local`. The main session does provider setup and secrets first, then delegates code changes.

## CI cost (GitHub Actions)

- Every PR workflow sets `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`.
- Trigger on `pull_request` and `push` to `main` only. Use `paths`/`paths-ignore` so docs- or content-only changes skip build, test and E2E jobs.
- Build and test only affected packages (e.g. Turborepo `--filter=...[origin/main]`); run the full suite on `main` only.
- Cache dependencies and build outputs (setup-node cache, Turborepo cache).
- Use `ubuntu-latest`. No macOS or Windows runners unless a job truly needs them; they bill at higher multipliers.
- Set `timeout-minutes` on every job, and fail fast by running lint and typecheck before tests and E2E.
- Skip E2E and other expensive jobs on draft PRs; run them on `ready_for_review` and `main`.
- Keep scheduled workflows to the minimum frequency, and remove crons that produce nothing.
- Set artifact and log retention to 7 days or less.
- Ask first before adding larger or self-hosted runners, paid Actions features, or changing spending limits.
