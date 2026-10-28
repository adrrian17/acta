# Implementation Plan: notes

Source: [docs/SPEC-notes.md](../docs/SPEC-notes.md) (approved, no open questions). Module id `notes`, depends on `owner-access` (shipped in #1) ([capability map](../docs/CAPABILITY-MAP.md)). Tasks: [todo-notes.md](./todo-notes.md) (written after this plan is approved). "AC n" refers to the spec's acceptance criterion n.

## Overview

Add Notes, derived Tags, the lifecycle (Timeline, Archived, Trashed, Pinned), version-guarded writes, the tag panel, the daily purge and the web UI. Domain rules are pure functions in `packages/api/src/notes/`; routers validate, call them and persist with one `db.batch` per write.

## Architecture Decisions

### Integration tests run on an in-process D1 (the detail the spec left for planning)

The spec allows a scripted manual fallback if wiring a local D1 into `vp test` is too costly. It is not: Node 24 ships `node:sqlite`, and `createDb` only needs an object with D1's `prepare`/`bind`/`all`/`run`/`raw`/`first`/`batch` surface.

- `packages/api/src/test/d1.ts` (test-only): a ~50-line `D1Database` shim over `node:sqlite` (`DatabaseSync`) that runs `batch` inside `BEGIN`/`COMMIT` (rollback on throw) and returns `meta.changes`. It applies every `packages/db/src/migrations/**/migration.sql` on creation and turns on `PRAGMA foreign_keys` (D1 enforces them; the cascade from `note` to `note_tag` depends on it).
- Tests build the real `createDb(shim)` (the `drizzle-orm/d1` driver the Worker uses) and call `appRouter.createCaller({ db, session, ownerGithubId })` with a seeded Owner `user` + `account`, so `protectedProcedure` runs unchanged.
- No new dependency. What the shim does not prove: D1's 100-bound-parameter cap and its exact batch semantics. The chunking helper gets a unit test on its own, and the manual checkpoint runs the conflict and rename flows against `pnpm dev` (real local D1 via Alchemy).

### Other decisions

- **One chunk helper** (`chunk(items, size)`) in `packages/api/src/notes/` sizes every multi-row statement under 100 parameters (`note_tag` inserts take 2 per row, so 49 rows per insert).
- **Tag writes in a batch** follow the spec's order: `DELETE FROM note_tag WHERE note_id = ? AND EXISTS (SELECT 1 FROM note WHERE id = ? AND version = ?)`, then `INSERT … SELECT … WHERE EXISTS (…version = ?)`, then the final guarded `UPDATE note`. The router reads `meta.changes` of the last result.
- **Rename/delete** read the affected Timeline and Archived Notes (`tag` match with the spec's `>=`/`<` range), compute new content with the tokenizer, validate it with `noteContent`, and write each Note with its own guarded batch. Notes that fail validation or lose the version check count as `skipped`.
- **Tag tree** is built in TypeScript from `SELECT DISTINCT note_id, tag` over non-Trashed Notes: each Note's tags are expanded to ancestors, deduplicated per Note, then counted. One Owner's data, so one query is enough.
- **Cron:** `crons: ["0 3 * * *"]` on the `server` Worker in `alchemy.run.ts`; `apps/server/src/index.ts` exports `{ fetch: app.fetch, scheduled }`, with `scheduled` calling `purgeTrashedNotes(getDb(), Date.now())` through `ctx.waitUntil`. Alchemy 2.0.0-beta.84 documents this shape in `src/Workers/CronEventSource.ts`.
- **Spec fix-up:** the spec assumes the first migration also creates the auth tables. `owner-access` already generated `20261027132008_dashing_doorman`, so `notes` adds a second migration. The spec line gets updated in Task 1.

## Dependency Graph

```
T1 schema + migration ─────────────┬─► T5 D1 test harness ─► T6 notes router ─► T7 tags router
T2 content + lifecycle (pure) ─────┤                              │                │
T3 tokenizer (pure) ───────────────┤                              ├─► T8 purge + cron
T4 cursor + chunk (pure) ──────────┘                              │
                                                                  └─► T9 Timeline UI ─► T10 Archive/Trash UI ─► T11 tag panel UI ─► T12 conflict dialog
```

T1–T4 are independent of each other.

## Task List

### Phase 1: Foundation (pure, no I/O)

- [x] Task 1: `note` and `note_tag` schema, relations, generated migration
- [x] Task 2: `content.ts` and `lifecycle.ts` with tests (AC 2, 3, 4, 6)
- [x] Task 3: Tag tokenizer `extractTags`, `renameTag`, `deleteTag`, `isValidTag` with tests (AC 7, 8, 10, 11 text rules)
- [x] Task 4: `cursor.ts` and `chunk` with tests (AC 14 foundation)

### Checkpoint: Foundation

- [ ] `pnpm check` and `pnpm test` pass; `pnpm db:generate` produces no further diff
- [ ] Review with the human before Phase 2

### Phase 2: API

- [x] Task 5: In-process D1 test harness with a smoke test (migrations apply, cascade works, `batch` rolls back)
- [x] Task 6: `notes` router: list, get, create, update, setPinned, archive, unarchive, trash, restore, deletePermanently (`privateData` moves to Task 9) (AC 1 API, 2–4, 6, 9, 13–16, 19, 20, 22)
- [x] Task 7: `tags` router: tree, rename, delete (AC 10–12, 17, 18, 22)
- [x] Task 8: `purgeTrashedNotes`, `scheduled` handler, cron in Alchemy (AC 5)

### Checkpoint: API

- [x] All API-level ACs pass in `pnpm test`
- [x] Manual against `pnpm dev`: create, stale update gets `CONFLICT`, rename a Tag (real D1, real param cap)
- [ ] Review with the human before Phase 3

### Phase 3: UI

- [x] Task 9: Timeline at `/` with composer, Write/Preview (`@tanstack/markdown`), cards, edit, pin, archive, trash, Load more; delete `/dashboard` and the scaffold landing; header nav (AC 1, 13)
- [x] Task 10: Archive and Trash views with Restore and Delete permanently, `purgeAt` display, empty states (AC 1, 16)
- [x] Task 11: Tag panel with tree, counts, untagged, filter, Rename and Delete with confirmation and result toast (AC 9, 15, 17, 18 UI)
- [x] Task 12: Conflict dialog with Reload and Overwrite; error-code copy mapping (AC 6 UI, 21)

### Checkpoint: Complete

- [x] All 22 ACs pass through their test or manual check
- [x] `pnpm check` and `pnpm test` pass; migration committed
- [x] `rg "dangerouslySetInnerHTML|allowHtml: true" apps packages` returns nothing
- [ ] After `pnpm deploy`, the dashboard shows the `0 3 * * *` trigger on `server`

## Acceptance Criteria Coverage

| AC | Covered by | Proof |
| --- | --- | --- |
| 1 Full lifecycle via UI and tRPC | T6, T9, T10 | Router tests + manual |
| 2 Only allowed transitions | T2, T6 | `lifecycle.test.ts` matrix + router test |
| 3 Restore to previous state | T2, T6 | Unit + router test |
| 4 Pin rules | T2, T6 | Unit + router test |
| 5 Purge at 30 vs 29 days | T8 | Integration test with fixed `now` |
| 6 Content validation | T2, T6, T12 | `content.test.ts` + router test + manual copy |
| 7, 8 Tag extraction | T3 | `tags.test.ts` |
| 9 Filter with descendants, not `ideasx` | T6 | Router test |
| 10, 11 Rename and delete | T3, T7 | Unit + router test (Trashed untouched) |
| 12 Skip empty/too long | T7 | Router test |
| 13 Pinned first, edit does not move | T6 | Router test |
| 14 Paging exactly once | T4, T6 | Router test with equal `createdAt` and Pinned across pages |
| 15 Untagged filter | T6 | Router test |
| 16 Archive/Trash order, `purgeAt` | T6, T10 | Router test + manual |
| 17, 18 Tree and counts | T7, T11 | Router test + manual |
| 19, 20 Conflict, atomicity | T6 | Router test incl. stale save after newer one |
| 21 Conflict dialog | T12 | Manual with two windows |
| 22 Every write bumps `version` | T6, T7 | Router test per write |

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| The `node:sqlite` shim diverges from D1 (param cap, batch, error shapes) | Med: green tests, broken prod | `chunk` unit-tested against the 100 cap; Phase 2 manual checkpoint runs on real local D1 |
| `node:sqlite` is flagged experimental in Node 24 | Low: a warning in test output | Accepted; it needs no flag in Node 24 |
| `@tanstack/markdown` 1.0.0 API differs from what the spec assumes (raw HTML off, no autolink) | Med for T9 | Check the installed API with context7 at the start of T9; if raw HTML cannot be turned off, stop and ask |
| The tokenizer and the preview disagree on malformed Markdown | Low | Known limitation recorded in the spec |
| Alchemy beta changes `crons` | Low | Version is pinned; verified in the installed source |

## Open Questions

- None blocking.
