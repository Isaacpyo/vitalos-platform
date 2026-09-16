# ADR 011 Provider-neutral observability

Status: Accepted baseline.

Context: Production accountability needs telemetry without premature vendor lock-in. Decision: structured logs/errors/metrics/traces, correlation IDs and Web Vitals using OpenTelemetry conventions. Options: provider SDK everywhere or logs only. Reasons: portability and coherent operations. Trade-offs: adapter maintenance. Consequences: providers/SLOs selected later. Revisit triggers: concrete production requirements.
