import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const task = sqliteTable(
  "task",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    // A calendar day, YYYY-MM-DD; text sorts the same as the dates it holds.
    dueDate: text("due_date"),
    state: text("state", { enum: ["open", "done", "trashed"] })
      .default("open")
      .notNull(),
    stateBeforeTrash: text("state_before_trash", { enum: ["open", "done"] }),
    version: integer("version").default(1).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
    trashedAt: integer("trashed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("task_state_dueDate_createdAt_id_idx").on(
      table.state,
      table.dueDate,
      table.createdAt,
      table.id
    ),
    index("task_state_doneAt_idx").on(table.state, table.doneAt),
    index("task_state_trashedAt_idx").on(table.state, table.trashedAt),
  ]
);
