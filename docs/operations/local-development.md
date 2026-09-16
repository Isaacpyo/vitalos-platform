# Local development

Requirements: Node 24 LTS, Corepack, Docker only when running local Supabase. Run `corepack enable`, `pnpm install --frozen-lockfile`, copy `.env.example`, then `pnpm dev:web`, `pnpm dev:studio` or `pnpm storybook`. Run `pnpm check` before review. Supabase CLI commands must be discovered with `supabase --help`; use `supabase start` and `supabase test db` when Docker/CLI are available.
