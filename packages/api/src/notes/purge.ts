import type { Database } from "@acta/db";
import { note } from "@acta/db/schema/notes";
import { and, eq, inArray, lte } from "drizzle-orm";

import { TRASH_RETENTION_MS } from "./lifecycle";

// Bounds each DELETE so a large backlog never runs as one long statement.
const PURGE_BATCH_SIZE = 500;

/** Permanently deletes Notes trashed at least 30 days before `now`. Returns how many. */
export async function purgeTrashedNotes(
  db: Database,
  now: Date
): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_MS);

  const expired = db
    .select({ id: note.id })
    .from(note)
    .where(and(eq(note.state, "trashed"), lte(note.trashedAt, cutoff)))
    .limit(PURGE_BATCH_SIZE);

  let purged = 0;
  let changes = PURGE_BATCH_SIZE;

  while (changes === PURGE_BATCH_SIZE) {
    // oxlint-disable-next-line no-await-in-loop -- each batch depends on the previous one having deleted its rows
    const result = await db.delete(note).where(inArray(note.id, expired));
    ({ changes } = result.meta);
    purged += changes;
  }

  return purged;
}
