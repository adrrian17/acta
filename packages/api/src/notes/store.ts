import type { Database } from "@acta/db";
import { note, noteTag } from "@acta/db/schema/notes";
import { TRPCError } from "@trpc/server";
import { and, eq, exists, gte, lt, notExists, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";

import { chunk, D1_MAX_PARAMS } from "./chunk";
import type { LifecycleFields } from "./lifecycle";
import { toNote } from "./note";
import type { Note } from "./note";

// The D1 result of an UPDATE run inside a batch.
const d1RunResult = z.object({ meta: z.object({ changes: z.number() }) });

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
 * The statements for one write, guarded so they apply only while the Note is still at
 * `expectedVersion`. The version moves in the last statement (the UPDATE), so a write
 * that loses the check changes nothing.
 */
function writeStatements(
  db: Database,
  { id, expectedVersion, now, patch, tags }: NoteWrite
): BatchItem<"sqlite">[] {
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
    return [update];
  }

  const tagInserts = chunk(tags, TAG_ROWS_PER_STATEMENT).map((rows) =>
    db.run(
      sql`INSERT INTO note_tag (note_id, tag) SELECT column1, column2 FROM (VALUES ${sql.join(
        rows.map((tag) => sql`(${id}, ${tag})`),
        sql`, `
      )}) WHERE ${guard}`
    )
  );

  return [
    db.delete(noteTag).where(and(eq(noteTag.noteId, id), guard)),
    ...tagInserts,
    update,
  ];
}

/**
 * Applies every write in one batch, which D1 runs as one transaction and counts as one
 * query. Each write is guarded on its own version, so one that lost its check changes
 * nothing while the others still apply. Returns whether each write won.
 */
export async function writeNotes(
  db: Database,
  writes: readonly NoteWrite[]
): Promise<boolean[]> {
  const groups = writes.map((write) => writeStatements(db, write));
  const [first, ...rest] = groups.flat();

  if (first === undefined) {
    return [];
  }

  // shortcut: one batch for every write; split it if a rename ever nears D1's 30 s batch limit.
  const results: unknown[] = await db.batch([first, ...rest]);
  let end = 0;

  return groups.map((statements) => {
    end += statements.length;

    return d1RunResult.safeParse(results[end - 1]).data?.meta.changes === 1;
  });
}

/** Applies one write; see `writeNotes`. Returns whether it won. */
export async function writeNote(
  db: Database,
  write: NoteWrite
): Promise<boolean> {
  const [won] = await writeNotes(db, [write]);

  return won === true;
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

/** Notes tagged `tag` or one of its descendants; a range instead of LIKE, since `_` is a Tag character. */
export function taggedWith(db: Database, table: typeof note, tag: string): SQL {
  return exists(
    db
      .select({ noteId: noteTag.noteId })
      .from(noteTag)
      .where(
        and(
          eq(noteTag.noteId, table.id),
          or(
            eq(noteTag.tag, tag),
            and(gte(noteTag.tag, `${tag}/`), lt(noteTag.tag, `${tag}0`))
          )
        )
      )
  );
}

export function untagged(db: Database, table: typeof note): SQL {
  return notExists(
    db
      .select({ noteId: noteTag.noteId })
      .from(noteTag)
      .where(eq(noteTag.noteId, table.id))
  );
}
