# Enquiry sequence

How a website enquiry becomes a durable record and a notification (ADR 019). Email is a notification channel; the database is the record.

## Submission

```mermaid
sequenceDiagram
    autonumber
    actor V as Visitor
    participant B as Browser
    participant W as Next.js server boundary<br/>(route handler or server action)
    participant A as receiveEnquiry
    participant L as Rate limiter<br/>(Postgres)
    participant T as Cloudflare Turnstile
    participant D as PostgreSQL<br/>(submit_enquiry)

    V->>B: Fill form, submit
    B->>W: POST /api/enquiries (JSON) or form action
    W->>W: Same-origin, content type, size cap
    W->>A: body, hashed-IP inputs, correlation id
    A->>A: Validate enquirySchemaV2 (strict)
    alt invalid
        A-->>W: invalid + field errors
        W-->>B: 400 / form state "invalid"
    else honeypot filled or unknown keys
        A-->>W: rejected
        W-->>B: 403
    else valid
        A->>A: Privacy notice version equals the server's current version
        A->>L: rate_limit_consume(hashed IP)
        alt over limit
            A-->>W: rate-limited(retryAfter)
            W-->>B: 429 + Retry-After
        else allowed
            A->>D: find_enquiry_reference(idempotency key)
            alt replay of a stored enquiry
                D-->>A: original reference
                A-->>W: accepted(reference) (no human check, no global charge)
                W-->>B: 202 reference
            else new enquiry
            opt Turnstile configured (always, in production)
                A->>T: Siteverify(secret, token, ip)
                T-->>A: success / failure
            end
            alt human check failed
                A-->>W: rejected
                W-->>B: 403
            else passed or disabled
                A->>L: rate_limit_consume(global), charged only now
                A->>D: submit_enquiry(payload)
                Note over D: One transaction: enquiries row +<br/>notification_outbox row (enquiry.received.v1).<br/>Replayed idempotency key returns the original.
                D-->>A: id, reference, duplicate
                A-->>W: accepted(reference)
                W-->>B: 202 reference / form state "accepted"
                W--)W: after(): best-effort dispatch (failure to schedule is ignored)
            end
            end
        end
    end
    Note over A,D: Any dependency failure at any step is<br/>"unavailable": HTTP 503, nothing half-stored.
```

## Notification (outbox dispatch)

```mermaid
sequenceDiagram
    autonumber
    participant S as Trigger<br/>after() / scheduler / local script
    participant R as /api/internal/outbox/dispatch<br/>(Bearer secret)
    participant X as dispatchOutbox
    participant D as PostgreSQL<br/>(claim_outbox_batch, mark_outbox)
    participant N as Notifier<br/>(console now; email provider later)

    S->>R: POST (Authorization: Bearer ...)
    R->>X: dispatch one batch
    X->>D: claim_outbox_batch(n)
    Note over D: FOR UPDATE SKIP LOCKED, attempts + 1,<br/>5 minute lease. Expired leases are reclaimed.<br/>attempts is the lease token: a stale worker cannot mark a re-claimed row.
    D-->>X: work items (enquiry + event)
    loop each item
        X->>N: send(kind, idempotency key enquiryId:kind)
        alt sent
            X->>D: mark_outbox(id, attempts, sent)
        else retryable failure, attempts left
            X->>D: mark_outbox(id, attempts, pending, code, backoff)
            Note over X,D: 60 s, 120 s, 240 s ... capped at 1 h
        else permanent failure or attempts exhausted
            X->>D: mark_outbox(id, attempts, failed, code)
            Note over D: Dead-letter: stays visible for operators.<br/>The enquiry itself is never lost.
        end
    end
    R-->>S: counts only (claimed, sent, retried, failed)
```

## Data and trust boundaries

```mermaid
flowchart LR
    Browser -- "HTTPS, same-origin" --> Web["Next.js server<br/>(server-only code)"]
    Web -- "secret key,<br/>function calls only" --> DB[("PostgreSQL<br/>RLS on, no anon/authenticated access")]
    Web -- "server-side verify" --> CF["Turnstile Siteverify"]
    DB --> Outbox["notification_outbox"]
    Outbox --> Notifier["Notifier port"]
    Notifier -. "approved provider only" .-> Email["Email provider"]
```

- The browser never touches tables or functions; `anon` and `authenticated` have no privileges.
- Logs carry identifiers, counts and error codes. They never carry name, email, goal or organisation. The IP exists only as a salted hash.
- The outbox payload carries identifiers only. The notifier receives the enquiry content in memory at send time.
