# Vitalos platform architecture

Vitalos uses a TypeScript-first modular monolith and independently deployable applications. Applications may import `@vitalos/*` public entrypoints, never another application's source. Provider adapters depend inward on domain interfaces. A capability is extracted only for justified scaling, isolation, ownership, runtime, availability or release-cadence needs; extracted services own their data and integrate using versioned APIs/events.

Current: Next.js web, isolated Sanity Studio, Storybook, shared foundations, local Supabase migrations, and the isolated Django Super Admin in `superadmin/` (internal, `admin.vitalos.co.uk`, own PostgreSQL; ADR-016). Future: client/ops/docs/mobile apps, workers, public APIs, containers and regional deployment are documented but absent.

See `docs/architecture/` and `docs/adr/`.
