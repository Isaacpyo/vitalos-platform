# Future service model

```mermaid
flowchart LR
Module[In-process domain module] -->|scale isolation ownership runtime SLO or cadence earned| Service[Independent service]
Service --> OwnDB[(Owned persistence)]
Service --> API[Versioned API]
Service --> Events[Versioned idempotent events]
```

Events use `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `correlationId`, `causationId`, and `payload`. Do not introduce an event bus until a durable asynchronous boundary exists.
