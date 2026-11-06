import type { Database } from "@acta/db";
import { task } from "@acta/db/schema/tasks";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { byId, protectedProcedure, router, versioned } from "../index";
import { decodeCursor, pageLimit, toPage } from "../paging";
import type { CursorKey } from "../paging";
import { doneCursor, openCursor } from "../tasks/cursor";
import { applyTransition, TASK_STATES } from "../tasks/lifecycle";
import type { TaskState, Transition } from "../tasks/lifecycle";
import { toTask } from "../tasks/task";
import type { Task } from "../tasks/task";
import { taskDueDate, taskTitle } from "../tasks/title";
import { trashCursor } from "../trash";

export const TASK_PAGE_SIZE = 50;

const listInput = z.object({
  view: z.enum(TASK_STATES),
  cursor: z.string().optional(),
  limit: pageLimit(TASK_PAGE_SIZE),
});

type View = z.infer<typeof listInput>["view"];

function taskNotFound(): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
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

    // Tasks without a Due date come after every dated Task.
    return key.dueDate === null
      ? sql`(${task.dueDate} IS NULL AND (${task.createdAt}, ${task.id}) > (${key.createdAt}, ${key.id}))`
      : sql`(${task.dueDate} IS NULL OR (${task.dueDate}, ${task.createdAt}, ${task.id}) > (${key.dueDate}, ${key.createdAt}, ${key.id}))`;
  }

  if (view === "done") {
    const key = decodeCursor(cursor, doneCursor);

    return sql`(${task.doneAt}, ${task.id}) < (${key.doneAt}, ${key.id})`;
  }

  const key = decodeCursor(cursor, trashCursor);

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

function cursorKey(item: Task, view: View): CursorKey {
  if (view === "open") {
    return { dueDate: item.dueDate, createdAt: item.createdAt, id: item.id };
  }

  return view === "done"
    ? { doneAt: item.doneAt ?? 0, id: item.id }
    : { trashedAt: item.trashedAt ?? 0, id: item.id };
}

async function applyTaskTransition(
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

function transition(action: Transition) {
  return protectedProcedure
    .input(versioned)
    .mutation(
      async ({ ctx, input }) => await applyTaskTransition(ctx.db, input, action)
    );
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

    return toPage(rows, input.limit, toTask, (item) =>
      cursorKey(item, input.view)
    );
  }),

  counts: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ state: task.state, total: count() })
      .from(task)
      .groupBy(task.state);

    // A new TaskState fails to compile here until it gets its zero.
    const counts: Record<TaskState, number> = {
      open: 0,
      done: 0,
      trashed: 0,
    };

    for (const { state, total } of rows) {
      counts[state] = total;
    }

    return counts;
  }),

  get: protectedProcedure.input(byId).query(async ({ ctx, input }) => {
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

  markDone: transition("markDone"),
  reopen: transition("reopen"),
  trash: transition("trash"),
  restore: transition("restore"),

  deletePermanently: protectedProcedure
    .input(byId)
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
