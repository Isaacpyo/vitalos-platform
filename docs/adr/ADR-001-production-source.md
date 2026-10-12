# ADR 001 New private production source of truth

Status: Accepted. Repository public since 12 Oct 2026 (see the last status update).

Context: The approved strategy rejects the obsolete public prototype. Decision: this `vitalos-platform` repository is the new engineering source; no production connection occurs yet. Options: reuse obsolete repo, use `vitalos-web`, or this name. Reasons: clean provenance and broader remit. Trade-offs: owner must create/confirm a private remote. Consequences: old history is not migrated wholesale. Revisit triggers: discovery of an already-approved private repository.

Status update (10 Oct 2026): a private GitHub repository, `Isaacpyo/vitalos-platform`, now exists and holds this source (visibility verified private). The owner has not yet recorded confirmation of repository ownership or of the live deployment source (launch gate G0; `docs/migration/source-reconciliation.md`). The decision above is unchanged.

Status update (12 Oct 2026): the owner made the source public so GitHub Actions runs on the free public-repository allowance. Before publishing, the full history was scanned with gitleaks (no real secrets; verified false positives allowlisted in `.gitleaks.toml`) and rewritten with git-filter-repo to remove internal-only material: the strategy library (`docs/strategy/`), research (`docs/research/`), delivery notes (stage plan and status, owner decisions, handoffs, overnight report) and personal email addresses. The public repository `Isaacpyo/vitalos-platform` was created fresh from that rewritten history, so no pull request ref keeps the removed material; the previous private repository is kept, private, as `Isaacpyo/vitalos-platform-archive`. The code is proprietary (`LICENSE`).
