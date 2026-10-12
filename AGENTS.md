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
