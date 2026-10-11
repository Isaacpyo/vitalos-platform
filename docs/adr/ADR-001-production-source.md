# ADR 001 New private production source of truth

Status: Accepted locally; private remote unconfirmed.

Context: The approved strategy rejects the obsolete public prototype. Decision: this `vitalos-platform` repository is the new engineering source; no production connection occurs yet. Options: reuse obsolete repo, use `vitalos-web`, or this name. Reasons: clean provenance and broader remit. Trade-offs: owner must create/confirm a private remote. Consequences: old history is not migrated wholesale. Revisit triggers: discovery of an already-approved private repository.

Status update (10 Oct 2026): a private GitHub repository, `Isaacpyo/vitalos-platform`, now exists and holds this source (visibility verified private). The owner has not yet recorded confirmation of repository ownership or of the live deployment source (launch gate G0; `docs/migration/source-reconciliation.md`). The decision above is unchanged.
