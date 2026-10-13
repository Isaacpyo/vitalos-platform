# ADR 014 Security and secrets baseline

Status: Accepted.

Context: Public forms, CMS and delivery create attack surfaces. Decision: least privilege, boundary validation, server authorization, secret isolation, scanning and evidence integrity. Options: provider defaults only or heavyweight platform. Reasons: proportionate defense. Trade-offs: ongoing review. Consequences: claims require evidence and privileged tables deny browser access. Revisit triggers: authentication, regulated data or incident.

Amendment (10 Oct 2026): GitHub code scanning uploads are unavailable while the repository is private and user-owned. CodeQL therefore runs with `upload: never`, publishes its SARIF as a workflow artifact and fails the job on any error- or warning-level finding, keeping the G8 CodeQL gate enforceable without paid Code Security. Revisit if the repository moves to an organisation with GitHub Code Security.

Status note (11 Oct 2026): `pnpm audit --audit-level high` is part of `pnpm check:security`. Transitive advisories are fixed with exact-version scoped `overrides` in `pnpm-workspace.yaml`; the one advisory with no upstream fix (braces, GHSA-vfj7-8cjw-p6xm) is an advisory-specific `auditConfig.ignoreGhsas` exception with a review date and a guard test, never a lower audit level. See `docs/security/dependency-advisories.md`.

Amendment (13 Oct 2026): the repository is public (ADR-001), so code scanning is free. CodeQL now uploads to code scanning (pull requests from forks keep results in the run) and still fails the job on any error- or warning-level finding. Workflow artifacts of a public repository are downloadable by any signed-in GitHub user: the Super Admin backup refuses to upload unless `BACKUP_PASSPHRASE` encrypts the dump, and the live smoke test no longer uploads its screenshots of real records.
