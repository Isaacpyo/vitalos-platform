# System context

```mermaid
flowchart LR
Visitor --> Web[Next.js web]
Editor --> Studio[Sanity Studio]
Studio --> Sanity[(Sanity editorial content)]
Web --> Sanity
Web --> Postgres[(Supabase PostgreSQL operational data)]
Web --> Providers[Email analytics monitoring adapters]
Cloudflare[Cloudflare DNS and optional Turnstile] --> Web
Vercel[Vercel hosting] --> Web
```

Only local/code foundations exist today; external production connections are future configuration.
