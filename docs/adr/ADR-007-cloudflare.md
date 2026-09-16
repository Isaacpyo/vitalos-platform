# ADR 007 Cloudflare DNS role

Status: Accepted intent.

Context: Existing DNS continuity must be protected. Decision: retain Cloudflare DNS and optionally Turnstile; do not assume proxying. Options: migrate DNS, proxy Vercel, DNS-only. Reasons: continuity without double-CDN complexity. Trade-offs: two providers remain. Consequences: cutover requires DNS/MX inventory. Revisit triggers: tested security/routing need.
