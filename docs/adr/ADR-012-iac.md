# ADR 012 Infrastructure as code policy

Status: Accepted policy; no resources defined.

Context: Remote changes must be repeatable and reviewable. Decision: reviewed Terraform where supported, separate environments, locked remote state and no automatic production apply. Options: dashboard-only or provision now. Reasons: auditability without unused infrastructure. Trade-offs: provider gaps and state operations. Consequences: empty conventions precede modules. Revisit triggers: first approved resource.
