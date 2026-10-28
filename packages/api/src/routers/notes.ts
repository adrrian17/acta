import type { Database } from "@acta/db";
import { note } from "@acta/db/schema/notes";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { noteContent } from "../notes/content";
import {
  decodeCursor,
  encodeCursor,
  timelineCursor,
  trashCursor,
} from "../notes/cursor";
import { applyTransition, canSetPinned, NOTE_STATES } from "../notes/lifecycle";
import type { Transition } from "../notes/lifecycle";
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
import { extractTags, isValidTag, normalizeTag } from "../notes/tags";

export const PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

const noteId = z.object({ id: z.string() });
const versioned = z.object({ id: z.string(), version: z.int().positive() });

const tagInput = z
  .string()
  .transform(normalizeTag)
  .refine(isValidTag, { error: "Invalid tag" });

const listInput = z
  .object({
    view: z.enum(NOTE_STATES),
    tag: tagInput.optional(),
    untagged: z.literal(true).optional(),
    cursor: z.string().optional(),
    limit: z.int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
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

function badCursor(): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
}

/** Rows strictly after the cursor in the view's sort order. */
function afterCursor(input: ListInput, table: typeof note): SQL | undefined {
  if (input.cursor === undefined) {
    return undefined;
  }

  if (input.view === "trashed") {
    const key = decodeCursor(input.cursor, trashCursor);

    if (!key) {
      throw badCursor();
    }

    return sql`(${table.trashedAt}, ${table.id}) < (${key.trashedAt}, ${key.id})`;
  }

  const key = decodeCursor(input.cursor, timelineCursor);

  if (!key) {
    throw badCursor();
  }

  return sql`(${table.pinned}, ${table.createdAt}, ${table.id}) < (${key.pinned ? 1 : 0}, ${key.createdAt}, ${key.id})`;
}

function cursorOf(item: Note, view: ListInput["view"]): string {
  return view === "trashed"
    ? encodeCursor({ trashedAt: item.trashedAt ?? 0, id: item.id })
    : encodeCursor({
        pinned: item.pinned,
        createdAt: item.createdAt,
        id: item.id,
      });
}

async function transition(
  db: Database,
  { id, version }: z.infer<typeof versioned>,
  action: Transition
): Promise<Note> {
  const row = await readNote(db, id);

  if (!row) {
    throw noteNotFound();
  }

  if (row.version !== version) {
    throw await lostWriteError(db, id);
  }

  const now = new Date();
  const next = applyTransition(row, action, now);

  if (!next) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Cannot ${action} a note that is ${row.state}`,
    });
  }

  if (
    !(await writeNote(db, { id, expectedVersion: version, now, patch: next }))
  ) {
    throw await lostWriteError(db, id);
  }

  return await getNote(db, id);
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

    const items = rows.slice(0, input.limit).map(toNote);
    const last = items.at(-1);

    return {
      items,
      nextCursor:
        rows.length > input.limit && last ? cursorOf(last, input.view) : null,
    };
  }),

  get: protectedProcedure
    .input(noteId)
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
    .mutation(async ({ ctx, input }) => {
      const row = await readNote(ctx.db, input.id);

      if (!row) {
        throw noteNotFound();
      }

      if (row.version !== input.version) {
        throw await lostWriteError(ctx.db, input.id);
      }

      if (!canSetPinned(row.state, input.pinned)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only Timeline notes can be pinned",
        });
      }

      const won = await writeNote(ctx.db, {
        id: input.id,
        expectedVersion: input.version,
        now: new Date(),
        patch: { pinned: input.pinned },
      });

      if (!won) {
        throw await lostWriteError(ctx.db, input.id);
      }

      return await getNote(ctx.db, input.id);
    }),

  archive: protectedProcedure
    .input(versioned)
    .mutation(
      async ({ ctx, input }) => await transition(ctx.db, input, "archive")
    ),

  unarchive: protectedProcedure
    .input(versioned)
    .mutation(
      async ({ ctx, input }) => await transition(ctx.db, input, "unarchive")
    ),

  trash: protectedProcedure
    .input(versioned)
    .mutation(
      async ({ ctx, input }) => await transition(ctx.db, input, "trash")
    ),

  restore: protectedProcedure
    .input(versioned)
    .mutation(
      async ({ ctx, input }) => await transition(ctx.db, input, "restore")
    ),

  deletePermanently: protectedProcedure
    .input(noteId)
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
