# ADR 006 Supabase PostgreSQL operational persistence

Status: Accepted for local foundation; production project unapproved.

Context: Enquiries must survive notification failure. Decision: Postgres enquiry plus durable outbox, server-only writes, RLS and revoked browser roles. Options: email only, Sanity, another managed database. Reasons: durability and relational evolution. Trade-offs: database operations are introduced. Consequences: migrations and recovery runbook required. Revisit triggers: approved existing datastore or residency/scale needs.
