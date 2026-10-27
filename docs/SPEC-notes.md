# Spec: notes

Module id: `notes` ([capability map](./CAPABILITY-MAP.md)). Depends on: `owner-access` ([SPEC-owner-access.md](./SPEC-owner-access.md)). Vocabulary: [GLOSSARY.md](../GLOSSARY.md).

## Objective

The Owner captures quick Markdown Notes and finds them again. A Note is a single untitled block of Markdown. Its Tags are the `#tag` tokens in its text. A Note lives in the Timeline, Archived or Trashed, and can be Pinned while it is in the Timeline. The Owner browses the Timeline newest first, filters it by Tag, manages Tags from a tag panel, and never silently loses an edit made on another device.

Success means the Owner can write a Note in seconds, tag it inline, and later find it by Tag. Trashed Notes are purged on schedule, and a save from a stale device can never overwrite newer content without the Owner choosing to.

### Decisions taken while specifying

- **Preview renderer:** `@tanstack/markdown` 1.0.0 (React adapter) with raw HTML off. It is used only to render. It does not autolink bare URLs: `https://x.com` stays plain text in the preview, while `[text](url)` links work.
- **Tags are handled by acta's own tokenizer,** a pure function over the source text. The renderer's AST carries no source positions, and rename and delete must rewrite the exact text, so the same tokenizer extracts, renames and deletes. Known limitation: on malformed Markdown (for example an unclosed code fence) the preview and the tokenizer can disagree on what is code.
- **Purge:** a Workers Cron Trigger on the existing `server` Worker, daily at 03:00 UTC (`0 3 * * *`). A Note can outlive its 30 days by up to about 24 hours.
- **Concurrency token:** an integer `version` per Note, incremented on every write, instead of `updatedAt`. Millisecond timestamps can collide, while a counter cannot.
- **UI language:** English only (see `owner-access`).

### Acceptance criteria

Lifecycle

1. Through the UI and tRPC, the Owner can create, edit, pin, unpin, archive, unarchive, trash, restore and permanently delete a Note.
2. Only the brief's transitions are accepted: Timeline ↔ Archived, Timeline → Trashed, Archived → Trashed, Trashed → its previous state, Trashed → permanently deleted. Any other transition fails with `PRECONDITION_FAILED` and changes nothing.
3. A Note trashed from Archived restores to Archived. A Note trashed from the Timeline restores to the Timeline.
4. Pinning a Note that is not in the Timeline fails with `PRECONDITION_FAILED`. Archiving or trashing a Pinned Note unpins it. A Pinned Note that is archived comes back unpinned when unarchived.
5. The purge job, run with `now`, permanently deletes every Trashed Note with `trashedAt <= now − 30 days` and keeps every Note trashed later than that. Concretely, a Note trashed 30 days ago is gone and one trashed 29 days ago is still there.

Content validation

6. A save whose content is empty, whitespace-only or longer than 100,000 characters fails with `BAD_REQUEST`. This applies to create and to edit, and emptying an existing Note never deletes it. "Characters" means Unicode code points. "Whitespace-only" means `content.trim() === ""`. Content is stored exactly as typed, untrimmed.

Tags

7. `Hoy #Ideas y #ideas/libros` yields the Tags `ideas` and `ideas/libros`, and the stored text is unchanged.
8. `` `#notatag` ``, `#tag` inside a fenced code block, and `https://x.com/#frag` yield no Tags.
9. Filtering the Timeline by `ideas` returns Notes tagged `ideas` or `ideas/libros`, and not Notes tagged only `ideasx`.
10. Renaming `ideas` to `thoughts` rewrites `#ideas` to `#thoughts` and `#ideas/libros` to `#thoughts/libros` in Timeline and Archived Notes. Trashed Notes are untouched. The case of the rest of each Note is preserved.
11. Deleting the Tag `ideas` removes the tokens `#ideas` and `#ideas/libros` from Timeline and Archived Notes and leaves the surrounding words intact. `uno #ideas dos` becomes `uno dos`.
12. A rename or delete skips any Note it would leave empty or over 100,000 characters. The result reports how many Notes were changed and how many were skipped, and the skipped Notes are unchanged.

Timeline and views

13. The Timeline lists Pinned Notes first, then the rest by creation time, newest first. Editing a Note does not move it.
14. Paging through the Timeline, Archive or Trash with an unchanged data set returns every Note exactly once.
15. The "untagged" filter returns exactly the Timeline Notes with no Tags.
16. The Archive view lists Archived Notes newest-created first. The Trash view lists Trashed Notes most recently trashed first, each showing the date it will be purged.

Tag panel

17. The tag panel shows a tree of every Tag found in Timeline and Archived Notes. Intermediate levels appear even if no Note uses them alone (`#a/b/c` alone shows `a › b › c`). There is also an "untagged" entry.
18. Each tree node's count is the number of distinct Timeline and Archived Notes tagged with that Tag or one of its descendants. Trashed Notes never count.

Concurrent edits

19. Every edit carries the `version` the client last read. If the stored `version` differs, the save fails with `CONFLICT` and changes nothing: no content, no Tags, no `version`.
20. Two saves from the same stale version: the first succeeds and the second fails with `CONFLICT`.
21. On `CONFLICT`, the UI shows "This note changed on another device." with **Reload** (discards the local edit and loads the current Note) and **Overwrite** (saves the local edit against the current `version`).
22. Every write increments `version`: edit, pin, unpin, archive, unarchive, trash, restore, and a Tag rename or delete touching the Note. An open editor whose Note was changed by any of these hits `CONFLICT` on save.

## Tech Stack

Versions from `pnpm-workspace.yaml` unless stated:

- Drizzle ORM 1.0.0-rc.5 on D1, with `db.batch` for atomic multi-statement writes (D1 has no interactive transactions)
- tRPC ^11.19.0, Zod ^4.5.4
- React 19, TanStack Router ^1.170, TanStack Query ^5.104, `@acta/ui` (shadcn)
- `@tanstack/markdown` 1.0.0, a **new dependency** in `apps/web` (approved while specifying)
- Alchemy 2.0.0-beta.84 Worker `crons`
- Vitest via `vp test` (introduced by `owner-access`)

## Commands

```
Dev:            pnpm dev
Migrations:     pnpm db:generate      # after any schema change; commit the SQL
Check:          pnpm check
Fix:            pnpm fix
Test:           pnpm test
Deploy:         pnpm deploy            # Alchemy applies migrations and registers the cron
UI component:   pnpm dlx shadcn@latest add alert-dialog   # run from packages/ui (conflict dialog)
```

## Project Structure

```
packages/db/src/schema/notes.ts         → note and note_tag tables (new; exported from schema/index.ts)
packages/db/src/relations.ts            → add note ↔ note_tag relations
packages/db/src/migrations/             → generated migration (also the first one for the auth tables)

packages/api/src/notes/tags.ts          → tokenizer: extractTags, renameTag, deleteTag, isValidTag (pure)
packages/api/src/notes/tags.test.ts
packages/api/src/notes/lifecycle.ts     → allowed transitions and pinning rules (pure)
packages/api/src/notes/lifecycle.test.ts
packages/api/src/notes/content.ts       → content validation schema (Zod), shared limits
packages/api/src/notes/cursor.ts        → opaque cursor encode/decode
packages/api/src/notes/purge.ts         → purgeTrashedNotes(db, now)
packages/api/src/routers/notes.ts       → notes router
packages/api/src/routers/tags.ts        → tags router
packages/api/src/routers/index.ts       → mount notes and tags; remove privateData

apps/server/src/index.ts                → export { fetch, scheduled }; scheduled calls purgeTrashedNotes
packages/infra/alchemy.run.ts           → crons: ["0 3 * * *"] on the server Worker

apps/web/src/routes/_auth/index.tsx     → Timeline (replaces dashboard.tsx; "/" becomes the Timeline)
apps/web/src/routes/_auth/archive.tsx   → Archive view
apps/web/src/routes/_auth/trash.tsx     → Trash view
apps/web/src/components/notes/          → note-card, note-editor, note-preview, tag-panel, conflict-dialog
apps/web/src/components/header.tsx      → links: Timeline, Archive, Trash
apps/web/src/routes/index.tsx           → delete (scaffold landing)
apps/web/src/routes/_auth/dashboard.tsx → delete
```

The tokenizer lives in `packages/api` because only the server derives Tags. The web app never parses Tags itself. It shows what the API returns.

## Data Model

`note`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | `crypto.randomUUID()` |
| `content` | text, not null | Markdown exactly as typed |
| `state` | text enum `timeline` \| `archived` \| `trashed`, not null, default `timeline` |  |
| `state_before_trash` | text enum `timeline` \| `archived`, nullable | set when trashed, cleared on restore |
| `pinned` | integer boolean, not null, default false | only true when `state = timeline` |
| `version` | integer, not null, default 1 | incremented on every write |
| `created_at` | integer `timestamp_ms`, not null | never changes |
| `updated_at` | integer `timestamp_ms`, not null | display only, not a concurrency token |
| `trashed_at` | integer `timestamp_ms`, nullable | set when trashed, cleared on restore |

Indexes: `(state, pinned, created_at, id)` for the Timeline and Archive, and `(state, trashed_at)` for Trash and the purge.

`note_tag`

| Column | Type | Notes |
| --- | --- | --- |
| `note_id` | text, FK → `note.id` on delete cascade |  |
| `tag` | text, not null | lowercase, NFC-normalized, full path (`ideas/libros`) |

Primary key `(note_id, tag)`, plus an index on `tag`. Only the Tags written in the Note are stored. Ancestors (`ideas` for `ideas/libros`) are derived at query time.

**Descendant match without `LIKE`:** `_` is both a valid Tag character and a `LIKE` wildcard, so a Tag `t` and its descendants match with `tag = t OR (tag >= t || '/' AND tag < t || '0')`. The character `'0'` is the one right after `'/'`. This is index-friendly and has no escaping.

There is no owner column. The Instance holds exactly one Owner's content, and `owner-access` gates every procedure.

## Tag Grammar

The tokenizer scans the source text and applies these rules in order.

1. **Excluded regions:** fenced code blocks (from a line opening with three or more `` ` `` or `~` to the matching closing fence, or to the end of the Note if unclosed), inline code spans, Markdown link destinations (the `(…)` after `]`), and URLs (`scheme://` followed by non-whitespace characters).
2. **Start:** a `#` that is not escaped (`\#`) and is at the start of the text or preceded by whitespace, `(` or `[`.
3. **Body:** one or more segments of letters (`\p{L}`, accented included), marks (`\p{M}`), digits (`\p{N}`), `-` or `_`, joined by single `/`. The token ends at the first character outside that set. A trailing `/` and anything after a `//` are not part of the Tag.
4. **At least one letter.** `#1` and `#2026` are not Tags, which keeps "#1 priority" and issue numbers out.
5. **Identity:** NFC-normalized and lowercased. `#Ideas` and `#ideas` are the same Tag. The text keeps the Owner's original case.
6. **A heading `# Title`** (a `#` followed by a space) is never a Tag.

**Rename** (`from` → `to`, both valid Tags) replaces the prefix `from` with `to` in every token whose identity is `from` or starts with `from/`, and keeps the rest of the token as typed. `#Ideas/Libros` becomes `#thoughts/Libros`, which normalizes to the Tag `thoughts/libros`. Renaming onto an existing Tag merges the two. Renaming a Tag to itself or to one of its own descendants fails with `BAD_REQUEST`.

**Delete** removes every token whose identity is the Tag or one of its descendants. If a removal leaves two spaces in a row, they collapse into one. Whitespace at a line start or end is trimmed only where the removal created it. Newlines are never removed.

## Interfaces

All procedures use `protectedProcedure` (Owner-gated) and validate their input with Zod.

`notes` router

| Procedure | Input | Output | Errors |
| --- | --- | --- | --- |
| `list` | `{ view: "timeline" \| "archived" \| "trashed", tag?: string, untagged?: true, cursor?: string, limit?: 1–100 (default 30) }` | `{ items: Note[], nextCursor: string \| null }` | `BAD_REQUEST` (`tag` and `untagged` together, filters outside `timeline`, bad cursor) |
| `get` | `{ id }` | `Note` | `NOT_FOUND` |
| `create` | `{ content }` | `Note` | `BAD_REQUEST` |
| `update` | `{ id, content, version }` | `Note` | `BAD_REQUEST`, `NOT_FOUND`, `CONFLICT` |
| `setPinned` | `{ id, pinned, version }` | `Note` | `NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED` |
| `archive` / `unarchive` / `trash` / `restore` | `{ id, version }` | `Note` | `NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED` |
| `deletePermanently` | `{ id }` | `{ id }` | `NOT_FOUND`, `PRECONDITION_FAILED` (Note not Trashed) |

`Note` = `{ id, content, state, pinned, version, tags: string[], createdAt, updatedAt, trashedAt, purgeAt }`. Dates are epoch milliseconds. `purgeAt` is `trashedAt + 30 days` for Trashed Notes, otherwise `null`.

`tags` router

| Procedure | Input | Output | Errors |
| --- | --- | --- | --- |
| `tree` | none | `{ nodes: TagNode[], untaggedCount: number }`, where `TagNode = { name, path, count, children: TagNode[] }` | none |
| `rename` | `{ from, to }` | `{ changed: number, skipped: number }` | `BAD_REQUEST`, `NOT_FOUND` (no Note has `from`) |
| `delete` | `{ tag }` | `{ changed: number, skipped: number }` | `BAD_REQUEST`, `NOT_FOUND` |

**Atomic writes.** Each Note write is one `db.batch`: a conditional `UPDATE note … WHERE id = ? AND version = ?`, followed by tag-row statements that run only if that update took effect (conditioned on the new `version`). A save that loses the version check therefore changes neither content nor Tags. Rename and delete apply this per Note, so a concurrent edit to one Note makes only that Note skip, and it counts as skipped. D1 caps bound parameters at 100 per statement, so batches are chunked to stay under it.

**Cursor.** Opaque base64url of the last row's sort key: `(pinned, createdAt, id)` for Timeline and Archive, `(trashedAt, id)` for Trash. `id` breaks ties so that equal timestamps neither skip nor repeat.

**Purge.** `purgeTrashedNotes(db, now)` deletes Notes where `state = 'trashed' AND trashed_at <= now − 30 days`, in chunks. `note_tag` rows cascade. The Worker's `scheduled` handler calls it with `Date.now()`.

## UI

- **Timeline (`/`):** a composer at the top (textarea with Write/Preview tabs; **Save** or ⌘/Ctrl+Enter), the tag panel beside the list on wide screens and in a toggle on narrow ones, and Note cards rendered with the preview. A Pinned Note shows a pin marker. Pages load with "Load more", one page of 30 at a time.
- **Note card actions:** Edit (the card turns into the editor, with the same Write/Preview tabs), Pin/Unpin, Archive, Trash. In Archive: Unarchive, Trash. In Trash: Restore, Delete permanently (with confirmation).
- **Tag panel:** clicking a node filters the Timeline by it and its descendants, and "untagged" shows untagged Notes. Each node has Rename and Delete. Both confirm first, with the count of affected Notes.
- **Errors:** the web app maps tRPC codes to copy, as in `owner-access`.

### UI copy

| Key | Text |
| --- | --- |
| `nav.timeline` | Timeline |
| `nav.archive` | Archive |
| `nav.trash` | Trash |
| `composer.placeholder` | Write a note… Use #tags to organize it. |
| `editor.write` | Write |
| `editor.preview` | Preview |
| `editor.save` | Save |
| `editor.cancel` | Cancel |
| `note.pin` / `note.unpin` | Pin / Unpin |
| `note.archive` / `note.unarchive` | Archive / Unarchive |
| `note.trash` / `note.restore` | Move to trash / Restore |
| `note.deletePermanently` | Delete permanently |
| `note.deletePermanently.confirm` | Delete this note permanently? This can't be undone. |
| `note.purgeAt` | Deleted on {date} |
| `tags.title` | Tags |
| `tags.untagged` | Untagged |
| `tags.rename` / `tags.delete` | Rename / Delete |
| `tags.rename.confirm` | Rename #{from} to #{to} in {count} notes? |
| `tags.delete.confirm` | Remove #{tag} from {count} notes? The rest of each note stays. |
| `tags.result` | Updated {changed} notes. {skipped} skipped because they would end up empty or too long. |
| `error.empty` | A note can't be empty. |
| `error.tooLong` | A note can be at most 100,000 characters. |
| `conflict.title` | This note changed on another device. |
| `conflict.reload` | Reload |
| `conflict.overwrite` | Overwrite |
| `empty.timeline` | No notes yet. Write your first one above. |
| `empty.archive` | No archived notes. |
| `empty.trash` | Trash is empty. Notes here are deleted after 30 days. |

## Code Style

Follow [docs/agents/typescript.md](./agents/typescript.md) and [docs/agents/react.md](./agents/react.md). Keep domain rules in pure functions with named constants, and let routers only validate, call those functions and persist:

```ts
// packages/api/src/notes/lifecycle.ts
export const NOTE_STATES = ["timeline", "archived", "trashed"] as const;
export type NoteState = (typeof NOTE_STATES)[number];

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function canArchive(state: NoteState): boolean {
  return state === "timeline";
}

export function restoredState(
  stateBeforeTrash: Exclude<NoteState, "trashed">
): NoteState {
  return stateBeforeTrash;
}
```

```ts
// packages/api/src/notes/content.ts
export const NOTE_MAX_CHARS = 100_000;

export const noteContent = z
  .string()
  .refine((value) => value.trim() !== "", { error: "empty" })
  .refine((value) => [...value].length <= NOTE_MAX_CHARS, { error: "tooLong" });
```

## Testing Strategy

- **Runner:** `vp test`, with test files next to their source.
- **Unit (most of the weight):**
  - `tags.test.ts`: every Tag example in the acceptance criteria, plus escaped `\#`, headings, `(#tag)`, accents (`#canción`), NFC versus NFD input, a digits-only `#2026`, a trailing `/`, `//`, link destinations, an unclosed fence, `~~~` fences, rename merge, rename-to-descendant rejection, and delete whitespace collapsing.
  - `lifecycle.test.ts`: the full transition matrix (every allowed and every disallowed pair) and the pin rules.
  - `content.test.ts`: empty, whitespace-only, exactly 100,000 code points, 100,001 code points, and a 100,000-emoji string (to prove code points, not UTF-16 units).
  - `cursor.test.ts`: round-trip, and a garbage cursor rejected.
- **Integration (router + D1):** run the routers against a local D1 through Miniflare or Alchemy dev. Cover the conflict pair (criterion 20), atomicity (a rejected save leaves Tags untouched), pagination with equal `createdAt` values and Pinned Notes spanning pages (criterion 14), rename and delete skipping (criterion 12), and the purge boundary at 29 and 30 days with a fixed `now` (criterion 5). If wiring a local D1 into `vp test` proves too costly, these become a scripted manual check against `pnpm dev` and are recorded in the plan.
- **Manual (UI):** criteria 1, 16, 17 and 21 against `pnpm dev`, including the conflict dialog with two browser windows.
- Every acceptance criterion maps to at least one of the above.

## Boundaries

- **Always:** run `pnpm check` and `pnpm test` before calling a task done. Run `pnpm db:generate` after schema edits and review the SQL. Build every procedure on `protectedProcedure`. Use the glossary terms (Note, Tag, Timeline, Archived, Trashed, Pinned) in code and copy, and avoid the words each glossary entry lists under _Avoid_.
- **Ask first:** adding any dependency beyond `@tanstack/markdown`, changing the 30-day retention or the cron schedule, adding columns or tables beyond the Data Model above, or turning on raw HTML or autolinks in the renderer.
- **Never:** parse Tags on the client. Store Tags anywhere other than as derived `note_tag` rows. Let a stale `version` write. Touch Trashed Notes in a Tag rename or delete. Hand-edit migrations or `routeTree.gen.ts`. Use `dangerouslySetInnerHTML`.

## Success Criteria

- All 22 acceptance criteria pass through the tests or manual checks mapped above.
- `pnpm check` and `pnpm test` pass, and the generated migration is committed with the schema.
- After `pnpm deploy`, the Cloudflare dashboard shows the `0 3 * * *` trigger on the `server` Worker.
- `rg "dangerouslySetInnerHTML|allowHtml: true" apps packages` returns nothing.

## Assumptions

- The page size is 30 and the maximum `limit` is 100.
- Tags are filtered only in the Timeline. The Archive and Trash views have no filters.
- A Note with no Tags shows no Tag chips. Tags appear in the card exactly as typed, inside the rendered text, with no separate chip list.
- The first migration also creates the Better Auth tables, because none has been generated yet.
- `privateData`, `/dashboard` and the scaffold landing at `/` are removed.

## Open Questions

None. Resolved with the Owner while specifying:

1. **Tag panel versus filter scope.** Panel counts include Timeline and Archived Notes, as the brief says, while clicking a node filters only the Timeline. A Tag used only in Archived Notes can therefore show a count and an empty Timeline. Accepted.
2. **Tag delete includes descendants.** Deleting `ideas` also removes `#ideas/libros`, matching rename, filtering and the tree.
3. **Digits-only tokens are not Tags** (`#1`, `#2026`).
