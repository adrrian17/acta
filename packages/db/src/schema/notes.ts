import { defineRelationsPart, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const note = sqliteTable(
  "note",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    state: text("state", { enum: ["timeline", "archived", "trashed"] })
      .default("timeline")
      .notNull(),
    stateBeforeTrash: text("state_before_trash", {
      enum: ["timeline", "archived"],
    }),
    pinned: integer("pinned", { mode: "boolean" }).default(false).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    trashedAt: integer("trashed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("note_state_pinned_createdAt_id_idx").on(
      table.state,
      table.pinned,
      table.createdAt,
      table.id
    ),
    index("note_state_trashedAt_idx").on(table.state, table.trashedAt),
  ]
);

export const noteTag = sqliteTable(
  "note_tag",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => note.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.tag] }),
    index("note_tag_tag_idx").on(table.tag),
  ]
);

export const notesRelations = defineRelationsPart({ note, noteTag }, (r) => ({
  note: {
    tags: r.many.noteTag({
      from: r.note.id,
      to: r.noteTag.noteId,
    }),
  },
  noteTag: {
    note: r.one.note({
      from: r.noteTag.noteId,
      to: r.note.id,
    }),
  },
}));
