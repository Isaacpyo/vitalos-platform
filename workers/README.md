# Workers

No worker is deployed. Introduce one only for durable slow/retryable work. Require persisted job state, idempotency, bounded exponential backoff, timeouts, correlation IDs, failure visibility and graceful shutdown.
