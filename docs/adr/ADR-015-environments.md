# ADR 015 Environment model

Status: Accepted.

Context: Reviews and releases need isolation. Decision: local, per-PR preview, staging/QA when justified, and protected production with separate secrets/data and noindex outside production. Options: production only or many permanent environments. Reasons: safe feedback with economical operations. Trade-offs: staging may depend on plan capability. Consequences: promotion is gated, not date-driven. Revisit triggers: release cadence or compliance requires more isolation.
