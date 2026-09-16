# ADR 003 Modular monolith first

Status: Accepted.

Context: Today requires a website, not distributed operations. Decision: domain modules and deployable apps precede services. Options: microservices or single unstructured app. Reasons: strong boundaries with low operating cost. Trade-offs: some shared deployment cadence. Consequences: extraction needs evidence and an ADR. Revisit triggers: independent SLO, security, scale, runtime, ownership or cadence.
