# Brief: acta

Input for `/spec-driven-development`. Vocabulary is defined in [GLOSSARY.md](../GLOSSARY.md); decisions are recorded in [docs/adr/](./adr/).

## Product

acta is a personal knowledge system for a single Owner: quick Markdown notes first, with search, relations, tasks and agent memory added as separate modules. One Instance holds the content of exactly one Owner.

## Current state

The repo is a Better-T-Stack scaffold: TanStack Router (web), Hono + tRPC on Cloudflare Workers (server), Drizzle on D1, Better Auth 1.7.13, deployed with Alchemy (`packages/infra/alchemy.run.ts`). Only the Better Auth tables exist (`user`, `session`, `account`, `verification`). There is no R2 binding and no domain code yet.

## Capability map

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| `owner-access` | GitHub OAuth sign-in of the Owner, session, rejection of any other account | — |
| `notes` | Notes, Tags, pinning, Archived, Trashed, Timeline, tag panel | owner-access |
| `tasks` | Standalone Tasks (no projects, no relation to Notes) | owner-access |
| `search` | Full-text search and query operators over Notes | notes |
| `attachments` | Files and images on Notes, stored in R2 | notes |
| `note-history` | Note versions, diff and restore | notes |
| `links` | Wiki links and backlinks between Notes | notes |
| `agent-memory` | Persistent memory for AI agents, MCP endpoint | notes |

Build order: `owner-access` → `notes`, `tasks` → `search`, `attachments`, `note-history`, `links`, `agent-memory`.

Only `owner-access` and `notes` are detailed below. Every other module needs its own grilling and spec before work starts.

## Module: owner-access

- Sign-in is GitHub OAuth only. Email and password sign-in is removed (the scaffold currently enables it in `packages/auth/src/index.ts`).
- The Owner is identified by their numeric GitHub account ID, set in deployment configuration ([ADR 0001](./adr/0001-owner-pinned-by-github-account-id.md)).
- Any other GitHub account is rejected, including on the first sign-in of a fresh Instance. No user row is created for it.
- Every tRPC procedure that reads or writes content requires the Owner's session.

### Acceptance criteria

- Signing in with the configured GitHub account creates or resumes the Owner's session.
- Signing in with any other GitHub account fails with a clear message and leaves the `user` table unchanged.
- No email/password sign-up or sign-in endpoint is reachable.
- Content procedures called without a session return an unauthorized error.

## Module: notes

### Note

- A Note is one untitled block of Markdown, 1 to 100,000 characters.
- Saving empty or whitespace-only content is rejected. Emptying an existing Note is rejected too, never treated as a delete.
- The editor is a Markdown textarea with a rendered preview.

### Lifecycle

- States: Timeline (default), Archived, Trashed.
- Allowed transitions: Timeline ↔ Archived, Timeline → Trashed, Archived → Trashed, Trashed → its previous state (restore), Trashed → permanently deleted.
- Pinned is a flag. Only Timeline Notes can be Pinned. Archiving or trashing unpins the Note.
- Trashed Notes are purged automatically 30 days after being trashed. The Owner can also delete a Trashed Note permanently by hand.

### Tags

- A Note's Tags are the `#tag` tokens in its content. No separate tag field.
- Allowed characters: letters (including accented), digits, `-`, `_`, `/`. A `/` makes a Tag hierarchical.
- Tokens inside fenced code blocks, inline code and URLs are not Tags.
- Tags are recorded and shown in lowercase. The Note's text keeps the case the Owner typed.
- Filtering by a Tag includes its descendants: `#work` matches `#work/project`.
- Renaming a Tag rewrites its token in every affected Note, descendants included (`#work/x` → `#job/x`).
- Deleting a Tag removes only the token from the text and leaves the surrounding words alone.
- Rename and delete touch Timeline and Archived Notes only, never Trashed ones.

### Timeline

- Pinned Notes first, then the rest by creation time, newest first. Editing a Note does not move it.
- Cursor-based pagination.
- Filters: by Tag (with descendants) and "untagged".
- Archive and Trash are separate views that list Notes in those states.

### Tag panel

- A tree of Tags with the number of Notes for each, plus an "untagged" entry.
- Counts include Timeline and Archived Notes, not Trashed ones.

### Concurrent edits

- Every save carries the integer `version` the client last read.
- If the Note changed since then, the save is rejected with "this note changed on another device", and the Owner can reload or overwrite.

### Acceptance criteria

- Create, edit, archive, unarchive, trash, restore and permanently delete a Note through the UI and tRPC.
- An empty, whitespace-only or over-100,000-character save is rejected with a validation error.
- A Pinned Note that gets archived comes back unpinned when it is unarchived.
- A Note trashed 30 days ago is gone after the scheduled purge. A Note trashed 29 days ago is still there.
- `Hoy #Ideas y #ideas/libros` yields the Tags `ideas` and `ideas/libros`, and the text is unchanged.
- `` `#notatag` ``, `#tag` inside a fenced code block, and `https://x.com/#frag` yield no Tags.
- Filtering by `ideas` returns Notes tagged `ideas` or `ideas/libros`.
- Renaming `ideas` to `thoughts` rewrites `#ideas/libros` to `#thoughts/libros` in Timeline and Archived Notes and leaves Trashed Notes untouched.
- The Timeline lists Pinned Notes first, then by creation time descending, and paging through it never skips or repeats a Note.
- Two saves from the same stale version: the first succeeds and the second is rejected as a conflict.

## Out of scope

- Teams, roles, members, shared or public visibility, share links, generated note cards, public articles.
- Compatibility with other note apps' APIs, plugins, custom branding.
- Voice capture and transcription.
- A UI in any language other than English, and a language switch. Note content can be in any language.
- Local drafts, offline queue and sync.
- Rediscovery (daily review, random walk), statistics, heatmaps and calendar views.
- Projects. Tasks created from Notes.
- A rich-text (WYSIWYG) editor. It can replace the textarea later without migrating data, since storage stays Markdown.
- Email and password sign-in, Google sign-in.

## Resolved questions

Settled while writing the module specs; details live in [SPEC-owner-access.md](./SPEC-owner-access.md) and [SPEC-notes.md](./SPEC-notes.md).

- UI copy is English only, with no language switch. Exact copy is listed in each spec.
- The 30-day purge runs as a daily Workers Cron Trigger (`0 3 * * *`) on the `server` Worker, declared in Alchemy.
- The preview uses `@tanstack/markdown` with raw HTML off; Tags are parsed by acta's own tokenizer on the server.
