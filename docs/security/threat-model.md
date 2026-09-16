# Threat model

Assets: editorial integrity, enquiries, credentials, controlled evidence and production availability. Primary threats: form abuse/injection, secret leakage, CMS account compromise, supply-chain compromise, broken authorization, DNS/deployment takeover and false public claims. Controls: boundary validation, rate-limit/Turnstile adapter, server-only persistence, least privilege/RLS, isolated Studio access, protected reviews, pinned lockfile, scanning, secure headers and reversible cutover. Residual risks remain until providers, owners and incident routes are configured.
