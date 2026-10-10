# Observability

Use provider-neutral structured logs, errors, metrics, traces, correlation IDs and Web Vitals with OpenTelemetry conventions. Redact sensitive fields. Define service indicators before alerts. Provider selection and production SLOs are deferred until traffic and ownership exist. Decisions are recorded in ADR-011 and ADR-020.

## What exists today

| Capability       | Implementation                                                                                        | Location                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Structured logs  | JSON line per record: `timestamp`, `severity`, `service`, `env`, `event`, `correlationId`, attributes | `@vitalos/observability` (`createLogger`)               |
| Redaction        | Credential and personal-data keys masked; emails and bearer tokens scrubbed inside strings            | `@vitalos/security/redact`, applied by the logger       |
| Correlation id   | `x-request-id` assigned in `apps/web/proxy.ts`, forwarded to the app and echoed on the response       | `proxy.ts`, `@vitalos/observability` (`correlationId`)  |
| Error capture    | `ErrorReporter` interface, console implementation (`error.captured` log events)                       | `@vitalos/observability`, `apps/web/instrumentation.ts` |
| Analytics events | Closed taxonomy, schema-validated, no-op and logger sinks only                                        | `apps/web/src/features/analytics`                       |

## Log record

```json
{
  "timestamp": "2026-01-02T03:04:05.000Z",
  "severity": "error",
  "service": "vitalos-web",
  "env": "production",
  "event": "error.captured",
  "correlationId": "5b0f...",
  "source": "request",
  "method": "POST",
  "path": "/api/enquiries",
  "error": { "type": "Error", "message": "...", "stack": "..." }
}
```

Rules for callers:

- Event names are stable, dot-separated identifiers (`enquiry.received`, `outbox.dispatch_failed`). Put variable data in attributes, never in the event name.
- Reserved keys (`timestamp`, `severity`, `service`, `env`, `event`, `correlationId`) cannot be overwritten by attributes.
- Log identifiers and outcomes, not content. Enquiry fields (email, name, goal, message, company, phone, body, payload, IPs and forwarding headers) are redacted by key even if a caller passes them, but do not rely on that: do not pass them. `event` must be a static literal, never built from input. Strings are truncated to 8 KB and the logger never throws.
- Create a child logger per request: `logger.child({ correlationId })`.
- Request paths are logged without their query string.
- Inbound `x-request-id` values are only trusted when they match `^[A-Za-z0-9._-]{8,128}$`; otherwise a UUID replaces them, so a client cannot forge log lines.

## Error reporting

Application code depends on the `ErrorReporter` interface (`captureException(error, { correlationId, source, attributes })`). Today the console implementation writes `error.captured` records. A Sentry adapter will implement the same interface and be selected in `instrumentation.ts`; it is blocked on the owner supplying a DSN. Until then the platform runs without a third-party error provider. The adapter must apply the same redaction before sending.

## Analytics events (Stage 10 §22)

`contact_submit`, `offer_enquiry_submit`, `trust_enquiry_submit`, `primary_cta_click`, `case_study_view`, `insight_to_offer_click`, `lab_resource_click`. Properties are limited to route, slugs, CTA ids and enumerated outcomes; events or properties outside the taxonomy are dropped. No analytics provider, script or consent banner exists yet (owner decision). The logger sink makes events visible in logs for development.

## Not yet decided or built

- Metrics (HTTP volume and errors, latency, form success/failure, provider failures) and Core Web Vitals collection: depend on the provider choice.
- Tracing: OpenTelemetry conventions are followed for naming; no tracing platform is introduced for a single-request path.
- Uptime monitoring, alert routes and SLOs: `/api/health` exists as the probe target; targets and owners are pending.
- CSP violation reporting endpoint (ADR-020 revisit trigger).
