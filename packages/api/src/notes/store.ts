import type { Database } from "@acta/db";
import { note, noteTag } from "@acta/db/schema/notes";
import { TRPCError } from "@trpc/server";
import { and, eq, exists, sql } from "drizzle-orm";

import { chunk, D1_MAX_PARAMS } from "./chunk";
import type { LifecycleFields } from "./lifecycle";
import { toNote } from "./note";
import type { Note } from "./note";

// Each row binds (note_id, tag); the version guard binds two more.
const TAG_ROWS_PER_STATEMENT = Math.floor((D1_MAX_PARAMS - 2) / 2);

export function noteNotFound(): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
}

export async function readNote(db: Database, id: string) {
  return await db.query.note.findFirst({
    where: { id },
    with: { tags: { columns: { tag: true } } },
  });
}

export async function getNote(db: Database, id: string): Promise<Note> {
  const row = await readNote(db, id);

  if (!row) {
    throw noteNotFound();
  }

  return toNote(row);
}

export async function insertNote(
  db: Database,
  { content, tags, now }: { content: string; tags: string[]; now: Date }
): Promise<Note> {
  const id = crypto.randomUUID();

  const insert = db
    .insert(note)
    .values({ id, content, createdAt: now, updatedAt: now });

  const tagInserts = chunk(tags, TAG_ROWS_PER_STATEMENT).map((rows) =>
    db.insert(noteTag).values(rows.map((tag) => ({ noteId: id, tag })))
  );

  await db.batch([insert, ...tagInserts]);

  return await getNote(db, id);
}

interface NoteWrite {
  id: string;
  expectedVersion: number;
  now: Date;
  patch: Partial<LifecycleFields> & { content?: string };
  /** Replaces the Note's Tags when given. */
  tags?: string[];
}

/**
 * Applies the write only if the Note is still at `expectedVersion`, in one batch.
 * Every statement is guarded on the old version and the version moves last, so a
 * write that loses the check changes nothing. Returns whether it won.
 */
export async function writeNote(
  db: Database,
  { id, expectedVersion, now, patch, tags }: NoteWrite
): Promise<boolean> {
  const atExpectedVersion = and(
    eq(note.id, id),
    eq(note.version, expectedVersion)
  );

  const guard = exists(
    db.select({ id: note.id }).from(note).where(atExpectedVersion)
  );

  const update = db
    .update(note)
    .set({ ...patch, version: sql`${note.version} + 1`, updatedAt: now })
    .where(atExpectedVersion);

  if (tags === undefined) {
    const [result] = await db.batch([update]);

    return result.meta.changes === 1;
  }

  const tagInserts = chunk(tags, TAG_ROWS_PER_STATEMENT).map(
    (rows) =>
      sql`INSERT INTO note_tag (note_id, tag) SELECT column1, column2 FROM (VALUES ${sql.join(
        rows.map((tag) => sql`(${id}, ${tag})`),
        sql`, `
      )}) WHERE ${guard}`
  );

  const results = await db.batch([
    db.delete(noteTag).where(and(eq(noteTag.noteId, id), guard)),
    ...tagInserts.map((statement) => db.run(statement)),
    update,
  ]);

  return results.at(-1)?.meta.changes === 1;
}

/** The error for a write that lost its version check: the Note is gone, or it changed. */
export async function lostWriteError(
  db: Database,
  id: string
): Promise<TRPCError> {
  const row = await readNote(db, id);

  return row
    ? new TRPCError({
        code: "CONFLICT",
        message: "This note changed on another device.",
      })
    : noteNotFound();
}
