# Spec: tasks

Module id: `tasks` ([capability map](./CAPABILITY-MAP.md)). Depends on: `owner-access` ([SPEC-owner-access.md](./SPEC-owner-access.md)). Vocabulary: [GLOSSARY.md](../GLOSSARY.md).

## Objective

The Owner keeps a short list of things to do, apart from their Notes. A Task is a one-line plain-text title with an optional Due date. A Task is Open, Done or Trashed. The Owner captures a Task in seconds, sees what is due first, checks it off, and can undo a mistaken delete from the Trash.

Success means the Open list always shows the most urgent Task on top, a checked-off Task leaves the list without being lost, and a save from a stale device can never overwrite newer content without the Owner choosing to.

### Decisions taken while specifying

- **Plain text, one line.** A Task holds no Markdown and no body. Anything that needs more context is a Note, and Tasks never link to Notes.
- **No Tags, priority, subtasks, recurrence or reminders.** Each can be added later as a new column or table without migrating data.
- **Due date is a calendar day,** stored as `YYYY-MM-DD` text with no time and no time zone. Whether a Task is overdue is decided by the client in the browser's local time zone. The server never knows the Owner's time zone.
- **No Archived state.** Done already takes a Task out of the Open list and keeps it indefinitely.
- **Done is read-only.** A Done Task must be reopened before its title or Due date can change.
- **Purge:** the existing daily Cron Trigger (`0 3 * * *`) also purges Tasks trashed 30 or more days ago.
- **Concurrency token:** an integer `version` per Task, as in `notes`.

### Acceptance criteria

Lifecycle

1. Through the UI and tRPC, the Owner can create, edit, mark done, reopen, trash, restore and permanently delete a Task.
2. Only these transitions are accepted: Open ↔ Done, Open → Trashed, Done → Trashed, Trashed → its previous state, Trashed → permanently deleted. Any other transition fails with `PRECONDITION_FAILED` and changes nothing.
3. A Task trashed from Done restores to Done. A Task trashed from Open restores to Open.
4. Marking a Task Done sets `doneAt`. Reopening it clears `doneAt`. A restored Done Task keeps the `doneAt` it had when trashed.
5. Editing the title or Due date of a Done or Trashed Task fails with `PRECONDITION_FAILED`.
6. The purge job, run with `now`, permanently deletes every Trashed Task with `trashedAt <= now − 30 days` and keeps every Task trashed later than that. Done Tasks are never purged.

Content validation

7. A save whose title is empty, whitespace-only, longer than 500 characters or contains a line break fails with `BAD_REQUEST`. This applies to create and to edit, and emptying an existing Task never deletes it. "Characters" means Unicode code points. "Whitespace-only" means `title.trim() === ""`. The title is stored exactly as typed, untrimmed.
8. A Due date that is not a real calendar day in `YYYY-MM-DD` form (`2026-02-30`, `2026-1-5`) fails with `BAD_REQUEST`. A Due date in the past is accepted. `dueDate: null` clears it.

Views and order

9. The Open view lists Tasks with a Due date first, earliest date first, then Tasks without one. Ties, including all Tasks without a Due date, are broken by creation time, oldest first. Editing a title does not move the Task. Changing its Due date does.
10. The Done view lists Done Tasks by `doneAt`, most recent first. The Trash view lists Trashed Tasks by `trashedAt`, most recent first, each showing the date after which it will be purged.
11. Paging through any view with an unchanged data set returns every Task exactly once.
12. An Open Task whose Due date is before the browser's local today shows as overdue. One due today shows as due today. Neither changes the order.

Concurrent edits

13. Every write carries the `version` the client last read. If the stored `version` differs, the write fails with `CONFLICT` and changes nothing.
14. Two saves from the same stale version: the first succeeds and the second fails with `CONFLICT`.
15. On `CONFLICT` while editing, the UI shows "This task changed on another device." with **Reload** and **Overwrite**, as in `notes`. On `CONFLICT` from a one-click action (mark done, reopen, trash, restore), the UI refetches the Task and shows the error toast instead of a dialog.
16. Every write increments `version`: edit, mark done, reopen, trash and restore.

## Tech Stack

Same as `notes`: Drizzle on D1, tRPC, Zod, React 19, TanStack Router and Query, `@acta/ui`, Alchemy `crons`, `vp test`. No new dependencies. The Due date input is the native `<input type="date">` through the existing `Input` component.

## Commands

```
Dev:            pnpm dev
Migrations:     pnpm db:generate      # after the schema change; commit the SQL
Check:          pnpm check
Test:           pnpm test
Deploy:         pnpm deploy
```

## Project Structure

```
packages/db/src/schema/tasks.ts         → task table (new; exported from schema/index.ts)
packages/db/src/migrations/             → generated migration for task

packages/api/src/tasks/lifecycle.ts     → TASK_STATES, allowed transitions, edit rule (pure)
packages/api/src/tasks/lifecycle.test.ts
packages/api/src/tasks/title.ts         → title and dueDate Zod schemas, TASK_TITLE_MAX_CHARS
packages/api/src/tasks/title.test.ts
packages/api/src/tasks/cursor.ts        → open, done and trash cursor schemas (reuses encodeCursor/decodeCursor)
packages/api/src/tasks/purge.ts         → purgeTrashedTasks(db, now)
packages/api/src/tasks/purge.test.ts
packages/api/src/routers/tasks.ts       → tasks router
packages/api/src/routers/tasks.test.ts
packages/api/src/routers/index.ts       → mount tasks

apps/server/src/index.ts                → scheduled also calls purgeTrashedTasks

apps/web/src/routes/_auth/tasks.tsx     → /tasks with Open | Done | Trash tabs
apps/web/src/components/tasks/          → task-form, task-list, task-row
apps/web/src/components/sidebar.tsx     → add the Tasks nav entry
```

`encodeCursor` and `decodeCursor` move from `packages/api/src/notes/cursor.ts` to a shared module only if reusing them from `notes/` reads badly. Otherwise `tasks/cursor.ts` imports them as they are. `TRASH_RETENTION_MS` is reused from `notes/lifecycle.ts` the same way.

## Data Model

`task`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | `crypto.randomUUID()` |
| `title` | text, not null | plain text exactly as typed |
| `due_date` | text, nullable | `YYYY-MM-DD` |
| `state` | text enum `open` \| `done` \| `trashed`, not null, default `open` |  |
| `state_before_trash` | text enum `open` \| `done`, nullable | set when trashed, cleared on restore |
| `version` | integer, not null, default 1 | incremented on every write |
| `created_at` | integer `timestamp_ms`, not null | never changes |
| `updated_at` | integer `timestamp_ms`, not null | display only |
| `done_at` | integer `timestamp_ms`, nullable | set when marked Done, cleared on reopen |
| `trashed_at` | integer `timestamp_ms`, nullable | set when trashed, cleared on restore |

Indexes: `(state, due_date, created_at, id)` for the Open view, `(state, done_at)` for Done, and `(state, trashed_at)` for Trash and the purge.

Open order is `due_date IS NULL, due_date, created_at, id`. `YYYY-MM-DD` text sorts the same as the dates it holds.

There is no owner column, as in `notes`.

## Interfaces

All procedures use `protectedProcedure` and validate their input with Zod.

`tasks` router

| Procedure | Input | Output | Errors |
| --- | --- | --- | --- |
| `list` | `{ view: "open" \| "done" \| "trashed", cursor?: string, limit?: 1–100 (default 50) }` | `{ items: Task[], nextCursor: string \| null }` | `BAD_REQUEST` (bad cursor) |
| `counts` | none | `{ open: number, done: number, trashed: number }` | none |
| `get` | `{ id }` | `Task` | `NOT_FOUND` |
| `create` | `{ title, dueDate?: string \| null }` | `Task` | `BAD_REQUEST` |
| `update` | `{ id, title, dueDate: string \| null, version }` | `Task` | `BAD_REQUEST`, `NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED` |
| `markDone` / `reopen` / `trash` / `restore` | `{ id, version }` | `Task` | `NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED` |
| `deletePermanently` | `{ id }` | `{ id }` | `NOT_FOUND`, `PRECONDITION_FAILED` (Task not Trashed) |

`Task` = `{ id, title, dueDate, state, version, createdAt, updatedAt, doneAt, trashedAt, purgeAt }`. Timestamps are epoch milliseconds. `dueDate` is `YYYY-MM-DD` or `null`. `purgeAt` is `trashedAt + 30 days` for Trashed Tasks, otherwise `null`.

**Writes.** Each write is one conditional `UPDATE task … SET version = version + 1 WHERE id = ? AND version = ? AND state IN (…)`. When `meta.changes` is `0`, the router reads the Task and returns `NOT_FOUND` if it is gone, `CONFLICT` if the `version` differs, and `PRECONDITION_FAILED` otherwise. There are no child rows, so no `db.batch` is needed.

**Permanent delete.** One statement, `DELETE FROM task WHERE id = ? AND state = 'trashed'`, as in `notes`.

**Cursor.** Opaque base64url of the last row's sort key: `(dueDate, createdAt, id)` for Open, where a `null` `dueDate` sorts after every date; `(doneAt, id)` for Done; `(trashedAt, id)` for Trash.

**Purge.** `purgeTrashedTasks(db, now)` deletes Tasks where `state = 'trashed' AND trashed_at <= now − 30 days`, in chunks, like `purgeTrashedNotes`. The `scheduled` handler runs both purges.

## UI

- **Tasks (`/tasks`):** a Tasks entry in the sidebar under the Note views. At the top, a composer: a one-line title input with an optional date input beside it (the native `<input type="date">`, with a clear button once a date is set). Enter creates an Open Task with that Due date, or none, and clears both inputs. Below it, the tabs Open | Done | Trash. Pages load with "Load more".
- **Task row (Open):** a checkbox that marks the Task Done, the title, the Due date label, and a `⋯` menu with Edit and Move to trash. The label is "Overdue · {date}" in the destructive color when the date is past, "Today" when it is today, or the date otherwise.
- **Edit:** the row turns into a title input and a date input with a clear button, plus Save and Cancel. Enter saves and Escape cancels.
- **Task row (Done):** a checked checkbox that reopens the Task, the title struck through, the date it was marked Done, and a `⋯` menu with Move to trash.
- **Task row (Trash):** the title, the purge date, and a `⋯` menu with Restore and Delete permanently (with confirmation).
- **Errors:** the same tRPC code → copy mapping as `notes`.

### UI copy

| Key | Text |
| --- | --- |
| `nav.tasks` | Tasks |
| `tasks.composer.placeholder` | Add a task… |
| `tasks.tab.open` | Open |
| `tasks.tab.done` | Done |
| `tasks.tab.trash` | Trash |
| `task.markDone` | Mark as done |
| `task.reopen` | Mark as open |
| `task.actions` | Task actions |
| `task.edit` | Edit |
| `task.dueDate` | Due date |
| `task.clearDueDate` | Clear due date |
| `task.overdue` | Overdue · {date} |
| `task.dueToday` | Today |
| `task.doneAt` | Done {date} |
| `task.save` / `task.cancel` | Save / Cancel |
| `task.trash` / `task.restore` | Move to trash / Restore |
| `task.deletePermanently` | Delete permanently |
| `task.deletePermanently.confirm` | Delete this task permanently? This can't be undone. |
| `task.purgeAt` | Deleted after {date} |
| `error.task.empty` | A task can't be empty. |
| `error.task.tooLong` | A task can be at most 500 characters. |
| `error.task.badDate` | That date isn't valid. |
| `conflict.task.title` | This task changed on another device. |
| `empty.tasks.open` | Nothing to do. Add a task above. |
| `empty.tasks.done` | No finished tasks yet. |
| `empty.tasks.trash` | Trash is empty. Tasks here are deleted after 30 days. |

## Code Style

Follow [docs/agents/typescript.md](./agents/typescript.md) and [docs/agents/react.md](./agents/react.md). Domain rules stay in pure functions, as in `notes`:

```ts
// packages/api/src/tasks/lifecycle.ts
export const TASK_STATES = ["open", "done", "trashed"] as const;
export type TaskState = (typeof TASK_STATES)[number];

export function canEdit(state: TaskState): boolean {
  return state === "open";
}
```

```ts
// packages/api/src/tasks/title.ts
export const TASK_TITLE_MAX_CHARS = 500;

export const taskTitle = z
  .string()
  .refine((value) => value.trim() !== "", { error: "empty" })
  .refine((value) => !/[\r\n]/.test(value), { error: "multiline" })
  .refine((value) => [...value].length <= TASK_TITLE_MAX_CHARS, {
    error: "tooLong",
  });
```

## Testing Strategy

- **Unit:**
  - `lifecycle.test.ts`: the full transition matrix and the edit rule.
  - `title.test.ts`: empty, whitespace-only, a line break, exactly 500 code points, 501, 500 emoji. Due dates: valid, `2026-02-30`, `2026-1-5`, a past date, `null`.
  - Cursor round-trip for each view, including a `null` `dueDate`.
- **Integration (router + D1, like `routers/notes.test.ts`):** the conflict pair (criterion 14), restore to the previous state (3), editing a Done Task (5), Open order with mixed and missing Due dates and equal `createdAt` values across pages (9, 11), and the purge boundary at 29 and 30 days with a fixed `now`, including a Done Task that is never purged (6).
- **Manual (UI):** criteria 1, 12 and 15 against `pnpm dev`, including overdue and today labels and the conflict dialog with two browser windows.

## Boundaries

- **Always:** run `pnpm check` and `pnpm test`. Run `pnpm db:generate` and review the SQL. Build every procedure on `protectedProcedure`. Use the glossary terms (Task, Open, Done, Trashed, Due date).
- **Ask first:** adding any dependency, adding Tags, priority, subtasks, recurrence or reminders, adding any relation to Notes, or changing the 30-day retention.
- **Never:** store a time or time zone in `due_date`. Compute "overdue" on the server. Let a stale `version` write. Purge Done Tasks. Hand-edit migrations or `routeTree.gen.ts`.

## Success Criteria

- All 16 acceptance criteria pass through the tests or manual checks mapped above.
- `pnpm check` and `pnpm test` pass, and the generated migration is committed with the schema.
- After `pnpm deploy`, the daily trigger purges both Notes and Tasks.

## Assumptions

- The page size is 50, since Task rows are much shorter than Note cards. The maximum `limit` is 100.
- The composer does not parse dates out of the title ("tomorrow", "fri"). The Due date is only set through the date input.
- The sidebar shows the Open and Done Task counts, from `tasks.counts`.

## Open Questions

None. Resolved with the Owner while specifying: plain-text titles of 1 to 500 characters; Open ↔ Done plus Trashed with a 30-day purge; an optional day-only Due date; Open sorted by Due date then oldest first; no Tags or other extras; the `version` guard; a `/tasks` route with Open | Done | Trash tabs; Done Tasks read-only until reopened; overdue computed in the client; Done Tasks kept forever.
