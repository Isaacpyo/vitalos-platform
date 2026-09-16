# ADR 009 Application and package dependencies

Status: Accepted.

Context: Monorepos can hide coupling. Decision: apps use package public exports; no app-to-app imports, cycles, or domain-to-UI dependency. Options: conventions only or heavier build platform. Reasons: enforceable extraction boundaries. Trade-offs: some abstractions and tooling. Consequences: dependency-cruiser gate. Revisit triggers: false positives or graph complexity warrants another tool.
