# ADR 002 pnpm and Turborepo monorepo

Status: Accepted.

Context: Three apps and shared foundations need one estate. Decision: pnpm workspaces, Corepack and Turborepo. Options: separate repos, npm workspaces, Nx. Reasons: explicit lightweight graph and reproducible installs. Trade-offs: shared CI and upgrade coordination. Consequences: `@vitalos/*` namespace and root gates. Revisit triggers: organizational or scaling costs outweigh atomic changes.
