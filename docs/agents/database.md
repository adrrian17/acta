# Database

Drizzle ORM on Cloudflare D1 (SQLite). Schema lives in `packages/db/src/schema/`; migrations are generated into `packages/db/src/migrations/` and applied by Alchemy on `pnpm deploy` (see `packages/infra/alchemy.run.ts`).

## Workflow

1. Edit the schema in `packages/db/src/schema/`. New tables must be exported from `schema/index.ts` (the one allowed barrel) so drizzle-kit sees them.
2. Run `pnpm db:generate` and review the generated SQL before committing it.
3. Commit the schema change and its migration together.

## Rules

- **Never edit or delete a migration that has been committed to `main`.** Deployed instances have already applied it, and D1 won't re-run a changed file, so the schema silently drifts. Write a new migration instead.
- **Never hand-write a migration file** when `pnpm db:generate` can produce it. Drizzle tracks migrations in `migrations/meta/`, and a hand-written file desyncs that snapshot.
- **Watch for table rebuilds.** SQLite can't alter most column properties in place, so drizzle-kit rebuilds the table (create a copy, copy the rows, drop the original, rename). If the generated SQL contains `__new_` tables or `PRAGMA foreign_keys=OFF`, call it out in the PR. It's slow on large tables and can lose data if a column constraint rejects existing rows.
- **Drop columns in two steps.** First stop reading and writing the column, then remove it in a later migration.
- Better Auth owns `user`, `session`, `account` and `verification` (`schema/auth.ts`). Change them only through Better Auth config; don't add domain columns to them.
