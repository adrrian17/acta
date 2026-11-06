import type { Database } from "@acta/db";
import { note } from "@acta/db/schema/notes";
import { TRPCError } from "@trpc/server";
import { and, count, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { byId, protectedProcedure, router, versioned } from "../index";
import { noteContent } from "../notes/content";
import { timelineCursor } from "../notes/cursor";
import { applyPinned, applyTransition, NOTE_STATES } from "../notes/lifecycle";
import type {
  LifecycleFields,
  NoteState,
  Transition,
} from "../notes/lifecycle";
import { toNote } from "../notes/note";
import type { Note } from "../notes/note";
import {
  getNote,
  insertNote,
  lostWriteError,
  noteNotFound,
  readNote,
  taggedWith,
  untagged,
  writeNote,
} from "../notes/store";
import { extractTags, tagInput } from "../notes/tags";
import { decodeCursor, pageLimit, toPage } from "../paging";
import type { CursorKey } from "../paging";
import { trashCursor } from "../trash";

const PAGE_SIZE = 30;

const listInput = z
  .object({
    view: z.enum(NOTE_STATES),
    tag: tagInput.optional(),
    untagged: z.literal(true).optional(),
    cursor: z.string().optional(),
    limit: pageLimit(PAGE_SIZE),
  })
  .refine((input) => !(input.tag !== undefined && input.untagged), {
    error: "Filter by a tag or by untagged, not both",
  })
  .refine(
    (input) =>
      input.view === "timeline" ||
      (input.tag === undefined && input.untagged === undefined),
    { error: "Filters apply only to the Timeline" }
  );

type ListInput = z.infer<typeof listInput>;

/** Rows strictly after the cursor in the view's sort order. */
function afterCursor(input: ListInput, table: typeof note): SQL | undefined {
  if (input.cursor === undefined) {
    return undefined;
  }

  if (input.view === "trashed") {
    const key = decodeCursor(input.cursor, trashCursor);

    return sql`(${table.trashedAt}, ${table.id}) < (${key.trashedAt}, ${key.id})`;
  }

  const key = decodeCursor(input.cursor, timelineCursor);

  return sql`(${table.pinned}, ${table.createdAt}, ${table.id}) < (${key.pinned ? 1 : 0}, ${key.createdAt}, ${key.id})`;
}

function cursorKey(item: Note, view: NoteState): CursorKey {
  return view === "trashed"
    ? { trashedAt: item.trashedAt ?? 0, id: item.id }
    : { pinned: item.pinned, createdAt: item.createdAt, id: item.id };
}

/**
 * Applies a lifecycle change to the Note at `version`. `change` returns the fields to
 * write, or `null` when the Note's current state does not allow it.
 */
async function changeNote(
  db: Database,
  { id, version }: z.infer<typeof versioned>,
  change: (
    current: LifecycleFields,
    now: Date
  ) => Partial<LifecycleFields> | null,
  refusal: (state: NoteState) => string
): Promise<Note> {
  const row = await readNote(db, id);

  if (!row) {
    throw noteNotFound();
  }

  if (row.version !== version) {
    throw await lostWriteError(db, id);
  }

  const now = new Date();
  const next = change(row, now);

  if (!next) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: refusal(row.state),
    });
  }

  if (
    !(await writeNote(db, { id, expectedVersion: version, now, patch: next }))
  ) {
    throw await lostWriteError(db, id);
  }

  return await getNote(db, id);
}

function transition(action: Transition) {
  return protectedProcedure.input(versioned).mutation(
    async ({ ctx, input }) =>
      await changeNote(
        ctx.db,
        input,
        (current, now) => applyTransition(current, action, now),
        (state) => `Cannot ${action} a note that is ${state}`
      )
  );
}

export const notesRouter = router({
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const { db } = ctx;

    const filters = (table: typeof note) =>
      and(
        afterCursor(input, table),
        input.tag === undefined ? undefined : taggedWith(db, table, input.tag),
        input.untagged ? untagged(db, table) : undefined
      ) ?? sql`1`;

    const rows = await db.query.note.findMany({
      where: { state: input.view, RAW: filters },
      orderBy:
        input.view === "trashed"
          ? { trashedAt: "desc", id: "desc" }
          : { pinned: "desc", createdAt: "desc", id: "desc" },
      limit: input.limit + 1,
      with: { tags: { columns: { tag: true } } },
    });

    return toPage(rows, input.limit, toNote, (item) =>
      cursorKey(item, input.view)
    );
  }),

  counts: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ state: note.state, total: count() })
      .from(note)
      .groupBy(note.state);

    // A new NoteState fails to compile here until it gets its zero.
    const counts: Record<NoteState, number> = {
      timeline: 0,
      archived: 0,
      trashed: 0,
    };

    for (const { state, total } of rows) {
      counts[state] = total;
    }

    return counts;
  }),

  get: protectedProcedure
    .input(byId)
    .query(async ({ ctx, input }) => await getNote(ctx.db, input.id)),

  create: protectedProcedure.input(z.object({ content: noteContent })).mutation(
    async ({ ctx, input }) =>
      await insertNote(ctx.db, {
        content: input.content,
        tags: extractTags(input.content),
        now: new Date(),
      })
  ),

  update: protectedProcedure
    .input(versioned.extend({ content: noteContent }))
    .mutation(async ({ ctx, input }) => {
      const won = await writeNote(ctx.db, {
        id: input.id,
        expectedVersion: input.version,
        now: new Date(),
        patch: { content: input.content },
        tags: extractTags(input.content),
      });

      if (!won) {
        throw await lostWriteError(ctx.db, input.id);
      }

      return await getNote(ctx.db, input.id);
    }),

  setPinned: protectedProcedure
    .input(versioned.extend({ pinned: z.boolean() }))
    .mutation(
      async ({ ctx, input }) =>
        await changeNote(
          ctx.db,
          input,
          (current) => applyPinned(current, input.pinned),
          () => "Only Timeline notes can be pinned"
        )
    ),

  archive: transition("archive"),
  unarchive: transition("unarchive"),
  trash: transition("trash"),
  restore: transition("restore"),

  deletePermanently: protectedProcedure
    .input(byId)
    .mutation(async ({ ctx, input }) => {
      // One statement, so a concurrent restore cannot slip between a state read and the delete.
      const result = await ctx.db
        .delete(note)
        .where(and(eq(note.id, input.id), eq(note.state, "trashed")));

      if (result.meta.changes === 1) {
        return { id: input.id };
      }

      const row = await readNote(ctx.db, input.id);
      throw row
        ? new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Only trashed notes can be deleted permanently",
          })
        : noteNotFound();
    }),
});
