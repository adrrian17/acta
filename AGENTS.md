# acta

acta is a single-Owner personal knowledge system (notes first; search, relations, tasks and agent memory later). It is a pnpm monorepo: TanStack Router web app, Hono + tRPC server on Cloudflare Workers, Drizzle on D1, Better Auth.

## Commands

Use **pnpm** (not npm). Vite+ (`vp`) runs every task; there are no separate ESLint/Prettier configs. `vp check` alone does **not** typecheck.

Before calling a task done, run the checks for every kind of change you made:

| Change | Run |
| --- | --- |
| Any `.ts`/`.tsx` | `pnpm check` (lint + format + typecheck) |
| Drizzle schema | `pnpm db:generate`, commit the new migration, then `pnpm check` |
| An `.env.schema` file | `pnpm env:generate`, then `pnpm check` |
| `packages/ui/src/components/` | Use `shadcn add`; lint skips this folder, so `pnpm check` only covers types |
| Docs only | `pnpm fix` (formats Markdown); no typecheck needed |

There is no test runner yet.

## Generated files

Never edit these by hand. Change the source and regenerate.

| File | Source | Regenerate | Committed |
| --- | --- | --- | --- |
| `apps/web/src/routeTree.gen.ts` | `apps/web/src/routes/**` | `pnpm dev:web` or build | No |
| `{apps/web,apps/server,packages/db}/src/env.ts` | The root `.env.schema`, filtered by the `pick` list in that package's `.env.schema` | `pnpm env:generate` | No |
| `packages/db/src/migrations/**` | `packages/db/src/schema/**` | `pnpm db:generate` | Yes |

`apps/server/cloudflare-env.d.ts` is hand-written but derives its types from `packages/infra/alchemy.run.ts`; add bindings there, not in the `.d.ts`.

## Context

- Product scope: [docs/brief.md](docs/brief.md)
- Domain vocabulary: [GLOSSARY.md](GLOSSARY.md). Use these terms in code, UI copy and docs; avoid the words each entry lists under _Avoid_. The **Owner** is a domain concept and is not Better Auth's `user` table. Never rename existing DB tables, columns or library identifiers to match the glossary.
- Decisions: [docs/adr/](docs/adr/). Read them before proposing a new auth, identity, storage or data primitive. If a change contradicts an ADR, stop and ask.

## Read when relevant

- [Tooling and lint config](docs/agents/tooling.md): changing lint/format setup, pre-commit hooks, or ignore patterns
- [TypeScript conventions](docs/agents/typescript.md): writing any `.ts`/`.tsx`
- [React and UI](docs/agents/react.md): working in `apps/web` or `packages/ui`
- [Database](docs/agents/database.md): changing `packages/db` schema or migrations
