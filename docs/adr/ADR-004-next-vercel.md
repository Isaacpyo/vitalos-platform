# ADR 004 Next.js App Router and Vercel

Status: Accepted.

Context: Public web needs server-first rendering, previews and metadata. Decision: patched Next.js 16 Active LTS App Router on Vercel. Options: static generator, other hosts, Kubernetes. Reasons: framework-native delivery and previews. Trade-offs: managed-platform dependency. Consequences: domain logic avoids proprietary runtime APIs. Revisit triggers: cost, capability or portability constraints become material.
