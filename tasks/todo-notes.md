# Tasks: notes

Plan: [plan-notes.md](./plan-notes.md). Spec: [docs/SPEC-notes.md](../docs/SPEC-notes.md). "AC n" refers to the spec's acceptance criterion n.

Every task also clears the standing bar: `pnpm check` and `pnpm test` pass, glossary terms (Note, Tag, Timeline, Archived, Trashed, Pinned) are used in code and copy, every procedure is built on `protectedProcedure`, and no Tag parsing happens on the client.

## Task 1: Schema and migration

**Description:** Add the `note` and `note_tag` tables from the spec's Data Model, their relations, and the generated migration.

**Acceptance criteria:**

- [x] `packages/db/src/schema/notes.ts` defines both tables with the spec's columns, defaults, FK cascade, primary key `(note_id, tag)` and the three indexes; exported from `schema/index.ts`.
- [x] `relations.ts` adds `note` ↔ `note_tag`.
- [x] `pnpm db:generate` creates one new migration with no table rebuilds; a second run produces no diff.
- [x] The spec's "first migration also creates the Better Auth tables" assumption is updated.

**Verification:** `pnpm db:generate`, review the SQL, `pnpm check`.

**Files:** `packages/db/src/schema/notes.ts` (new), `schema/index.ts`, `relations.ts`, `migrations/*` (generated), `docs/SPEC-notes.md`.

**Scope:** S

## Task 2: Content validation and lifecycle rules

**Description:** Pure rules for content limits, allowed transitions and pinning.

**Acceptance criteria:**

- [x] `content.ts` exports `NOTE_MAX_CHARS` and `noteContent` (Zod): rejects empty, whitespace-only and over 100,000 code points with `empty` / `tooLong`; never trims.
- [x] `lifecycle.ts` exports `NOTE_STATES`, `TRASH_RETENTION_MS`, and one function per transition (archive, unarchive, trash, restore, pin) that returns the next state fields or reports the transition is not allowed. Archive and trash unpin; trash records `stateBeforeTrash`; restore returns to it.
- [x] Tests: the full transition matrix (AC 2), restore target (AC 3), pin rules (AC 4), and the content cases listed in the spec's Testing Strategy (AC 6).

**Verification:** `pnpm test`, `pnpm check`.

**Files:** `packages/api/src/notes/{content,lifecycle}.ts` and tests (new).

**Scope:** S

## Task 3: Tag tokenizer

**Description:** One scanner that finds Tag tokens with their source positions, used by `extractTags`, `renameTag`, `deleteTag` and `isValidTag`, following the spec's Tag Grammar.

**Acceptance criteria:**

- [x] Excluded regions: fenced blocks (`` ` `` and `~`, unclosed runs to end), inline code, link destinations, `scheme://` URLs.
- [x] Start, body, at-least-one-letter, NFC + lowercase identity, and heading rules as in the spec.
- [x] `renameTag` rewrites the prefix and keeps the rest as typed; rejects `to` equal to `from` or a descendant of it.
- [x] `deleteTag` removes tokens for the Tag and descendants, collapses double spaces it created, trims line-edge whitespace it created, never removes newlines.
- [x] Tests cover AC 7, 8, the text half of AC 10 and 11, and every extra case listed in the spec's Testing Strategy.

**Verification:** `pnpm test`, `pnpm check`.

**Files:** `packages/api/src/notes/tags.ts`, `tags.test.ts` (new).

**Scope:** M

## Task 4: Cursor and chunking

**Description:** Opaque cursor encode/decode for both sort keys, and the chunk helper that keeps statements under D1's 100-parameter cap.

**Acceptance criteria:**

- [x] `cursor.ts` round-trips `(pinned, createdAt, id)` and `(trashedAt, id)` as base64url; a garbage cursor decodes to an error the router maps to `BAD_REQUEST`.
- [x] `chunk(items, size)` splits into slices of at most `size`; tests include the empty list and an exact multiple.

**Verification:** `pnpm test`, `pnpm check`.

**Files:** `packages/api/src/notes/{cursor,chunk}.ts` and tests (new).

**Scope:** S

## Checkpoint: Foundation

- [x] `pnpm check` and `pnpm test` pass
- [ ] Review with the human

## Task 5: In-process D1 test harness

**Description:** The `node:sqlite` D1 shim from the plan, plus a helper that builds a caller with a seeded Owner.

**Acceptance criteria:**

- [x] `packages/api/src/test/d1.ts` implements the D1 surface `drizzle-orm/d1` uses, applies all migrations, enables foreign keys, and runs `batch` in one transaction.
- [x] A smoke test proves migrations apply, deleting a `note` cascades its `note_tag` rows, and a failing statement rolls back the whole batch.

**Files:** `packages/api/src/test/{d1,caller}.ts`, `d1.test.ts` (new).

**Scope:** S

## Task 6: notes router

**Description:** Every `notes` procedure from the spec's Interfaces, with guarded batches, `meta.changes` checks and the single-statement permanent delete. `privateData` is removed with `/dashboard` in Task 9, which still uses it.

**Acceptance criteria:**

- [x] Router tests for AC 1 (API), 2–4, 6, 9, 13–16, 19, 20 and 22 (notes writes), including a stale save after a newer one leaving Tags untouched and paging with equal `createdAt` and Pinned Notes across pages.

**Files:** `packages/api/src/routers/{notes,index}.ts`, `notes.test.ts`, `packages/api/src/notes/{note,store}.ts` (row → `Note` mapper, guarded writes).

**Not covered by a test:** the per-Note skip in Task 7 when a concurrent edit lands mid-rename; `writeNote`'s guard is proven by the AC 19/20 tests instead.

**Scope:** M

## Task 7: tags router

**Description:** `tree`, `rename`, `delete` as in the spec.

**Acceptance criteria:**

- [x] Router tests for AC 10–12, 17, 18 and 22 (tag writes), including Trashed Notes untouched and per-Note skip on a concurrent edit.

**Files:** `packages/api/src/routers/{tags,index}.ts`, `tags.test.ts`.

**Scope:** M

## Task 8: Purge and cron

**Description:** `purgeTrashedNotes(db, now)`, the Worker `scheduled` handler, and the cron trigger.

**Acceptance criteria:**

- [x] Integration test at 29 and 30 days with a fixed `now` (AC 5).
- [x] `alchemy.run.ts` declares `crons: ["0 3 * * *"]`; `apps/server/src/index.ts` exports `fetch` and `scheduled`.

**Files:** `packages/api/src/notes/purge.ts`, `purge.test.ts`, `apps/server/src/index.ts`, `packages/infra/alchemy.run.ts`.

**Scope:** S

## Checkpoint: API

- [ ] Manual against `pnpm dev`: create, stale update gets `CONFLICT`, rename a Tag
- [ ] Review with the human

## Task 9: Timeline UI

**Description:** `/` becomes the Timeline: composer with Write/Preview, Note cards with preview, edit, pin, archive, trash, Load more. Delete `/dashboard`, the scaffold landing and the `privateData` procedure. Point the login `callbackURL` at `/`. Header links.

**Pre-step (done):** `@tanstack/markdown` 1.0.0 escapes raw HTML (`allowHtml` is opt-in), does not autolink bare URLs and drops `javascript:` links by default, so no options are needed.

**Acceptance criteria:** AC 1 (Timeline actions) and 13 checked manually; UI copy from the spec.

**Scope:** M

## Task 10: Archive and Trash views

**Acceptance criteria:** AC 1 (Archive/Trash actions) and 16 checked manually; permanent delete confirms; empty-state copy.

**Scope:** S

## Task 11: Tag panel

**Acceptance criteria:** AC 9, 15, 17, 18 checked manually; Rename and Delete confirm with the affected count and show `tags.result`.

**Scope:** M

## Task 12: Conflict dialog and error copy

**Acceptance criteria:** AC 21 checked manually with two windows; `BAD_REQUEST` maps to `error.empty` / `error.tooLong` (AC 6 UI).

**Files:** `apps/web/src/components/notes/conflict-dialog.tsx`, `packages/ui` `alert-dialog` via `shadcn add`.

**Scope:** S

## Checkpoint: Complete

See [plan-notes.md](./plan-notes.md#checkpoint-complete).
