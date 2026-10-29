import type { Database } from "@acta/db";
import { task } from "@acta/db/schema/tasks";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { decodeCursor, encodeCursor, trashCursor } from "../notes/cursor";
import { doneCursor, openCursor } from "../tasks/cursor";
import { applyTransition, TASK_STATES } from "../tasks/lifecycle";
import type { Transition } from "../tasks/lifecycle";
import { toTask } from "../tasks/task";
import type { Task } from "../tasks/task";
import { taskDueDate, taskTitle } from "../tasks/title";

export const TASK_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const taskId = z.object({ id: z.string() });
const versioned = z.object({ id: z.string(), version: z.int().positive() });

const listInput = z.object({
  view: z.enum(TASK_STATES),
  cursor: z.string().optional(),
  limit: z.int().min(1).max(MAX_PAGE_SIZE).default(TASK_PAGE_SIZE),
});

type View = z.infer<typeof listInput>["view"];

function taskNotFound(): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
}

function badCursor(): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
}

async function readTask(db: Database, id: string) {
  return await db.query.task.findFirst({ where: { id } });
}

/** Why a guarded write changed nothing: the Task is gone, it changed, or its state forbids the write. */
async function lostWriteError(
  db: Database,
  id: string,
  version: number,
  reason: string
): Promise<TRPCError> {
  const row = await readTask(db, id);

  if (!row) {
    return taskNotFound();
  }

  return row.version === version
    ? new TRPCError({ code: "PRECONDITION_FAILED", message: reason })
    : new TRPCError({
        code: "CONFLICT",
        message: "This task changed on another device.",
      });
}

/** Rows strictly after the cursor in the view's sort order. */
function afterCursor(view: View, cursor: string | undefined): SQL | undefined {
  if (cursor === undefined) {
    return undefined;
  }

  if (view === "open") {
    const key = decodeCursor(cursor, openCursor);

    if (!key) {
      throw badCursor();
    }

    // Tasks without a Due date come after every dated Task.
    return key.dueDate === null
      ? sql`(${task.dueDate} IS NULL AND (${task.createdAt}, ${task.id}) > (${key.createdAt}, ${key.id}))`
      : sql`(${task.dueDate} IS NULL OR (${task.dueDate}, ${task.createdAt}, ${task.id}) > (${key.dueDate}, ${key.createdAt}, ${key.id}))`;
  }

  if (view === "done") {
    const key = decodeCursor(cursor, doneCursor);

    if (!key) {
      throw badCursor();
    }

    return sql`(${task.doneAt}, ${task.id}) < (${key.doneAt}, ${key.id})`;
  }

  const key = decodeCursor(cursor, trashCursor);

  if (!key) {
    throw badCursor();
  }

  return sql`(${task.trashedAt}, ${task.id}) < (${key.trashedAt}, ${key.id})`;
}

const ORDER_BY = {
  open: [
    sql`${task.dueDate} IS NULL`,
    asc(task.dueDate),
    asc(task.createdAt),
    asc(task.id),
  ],
  done: [desc(task.doneAt), desc(task.id)],
  trashed: [desc(task.trashedAt), desc(task.id)],
} satisfies Record<View, SQL[]>;

function cursorOf(item: Task, view: View): string {
  if (view === "open") {
    return encodeCursor({
      dueDate: item.dueDate,
      createdAt: item.createdAt,
      id: item.id,
    });
  }

  return view === "done"
    ? encodeCursor({ doneAt: item.doneAt ?? 0, id: item.id })
    : encodeCursor({ trashedAt: item.trashedAt ?? 0, id: item.id });
}

async function transition(
  db: Database,
  { id, version }: z.infer<typeof versioned>,
  action: Transition
): Promise<Task> {
  const row = await readTask(db, id);

  if (!row) {
    throw taskNotFound();
  }

  const reason = `Cannot ${action} a task that is ${row.state}`;

  if (row.version !== version) {
    throw await lostWriteError(db, id, version, reason);
  }

  const now = new Date();
  const next = applyTransition(row, action, now);

  if (!next) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: reason });
  }

  // Guarded on the version read above, so a write that raced in between makes this one lose.
  const [updated] = await db
    .update(task)
    .set({ ...next, version: sql`${task.version} + 1`, updatedAt: now })
    .where(and(eq(task.id, id), eq(task.version, version)))
    .returning();

  if (!updated) {
    throw await lostWriteError(db, id, version, reason);
  }

  return toTask(updated);
}

export const tasksRouter = router({
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select()
      .from(task)
      .where(
        and(eq(task.state, input.view), afterCursor(input.view, input.cursor))
      )
      .orderBy(...ORDER_BY[input.view])
      .limit(input.limit + 1);

    const items = rows.slice(0, input.limit).map(toTask);
    const last = items.at(-1);

    return {
      items,
      nextCursor:
        rows.length > input.limit && last ? cursorOf(last, input.view) : null,
    };
  }),

  get: protectedProcedure.input(taskId).query(async ({ ctx, input }) => {
    const row = await readTask(ctx.db, input.id);

    if (!row) {
      throw taskNotFound();
    }

    return toTask(row);
  }),

  create: protectedProcedure
    .input(z.object({ title: taskTitle, dueDate: taskDueDate.optional() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      const [created] = await ctx.db
        .insert(task)
        .values({
          id: crypto.randomUUID(),
          title: input.title,
          dueDate: input.dueDate ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return toTask(created);
    }),

  update: protectedProcedure
    .input(versioned.extend({ title: taskTitle, dueDate: taskDueDate }))
    .mutation(async ({ ctx, input }) => {
      // One statement: the version and the Open state are checked where the row is written.
      const [updated] = await ctx.db
        .update(task)
        .set({
          title: input.title,
          dueDate: input.dueDate,
          version: sql`${task.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(task.id, input.id),
            eq(task.version, input.version),
            eq(task.state, "open")
          )
        )
        .returning();

      if (!updated) {
        throw await lostWriteError(
          ctx.db,
          input.id,
          input.version,
          "Only open tasks can be edited"
        );
      }

      return toTask(updated);
    }),

  markDone: protectedProcedure
    .input(versioned)
    .mutation(
      async ({ ctx, input }) => await transition(ctx.db, input, "markDone")
    ),

  reopen: protectedProcedure
    .input(versioned)
    .mutation(
      async ({ ctx, input }) => await transition(ctx.db, input, "reopen")
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
    .input(taskId)
    .mutation(async ({ ctx, input }) => {
      // One statement, so a concurrent restore cannot slip between a state read and the delete.
      const result = await ctx.db
        .delete(task)
        .where(and(eq(task.id, input.id), eq(task.state, "trashed")));

      if (result.meta.changes === 1) {
        return { id: input.id };
      }

      const row = await readTask(ctx.db, input.id);
      throw row
        ? new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Only trashed tasks can be deleted permanently",
          })
        : taskNotFound();
    }),
});
