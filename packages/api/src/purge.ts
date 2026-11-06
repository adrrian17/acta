import type { Database } from "@acta/db";
import { note } from "@acta/db/schema/notes";
import { task } from "@acta/db/schema/tasks";
import { and, eq, inArray, lte } from "drizzle-orm";

import { TRASH_RETENTION_MS } from "./trash";

// Bounds each DELETE so a large backlog never runs as one long statement.
const PURGE_BATCH_SIZE = 500;

/** Every table whose rows can be Trashed, and so purged. */
export const TRASHABLE = [note, task] as const;

/** Permanently deletes rows trashed at least TRASH_RETENTION_MS before `now`. Returns how many. */
export async function purgeTrashed(
  db: Database,
  table: (typeof TRASHABLE)[number],
  now: Date
): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_MS);

  const expired = db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.state, "trashed"), lte(table.trashedAt, cutoff)))
    .limit(PURGE_BATCH_SIZE);

  let purged = 0;
  let changes = PURGE_BATCH_SIZE;

  while (changes === PURGE_BATCH_SIZE) {
    // oxlint-disable-next-line no-await-in-loop -- each batch depends on the previous one having deleted its rows
    const result = await db.delete(table).where(inArray(table.id, expired));
    ({ changes } = result.meta);
    purged += changes;
  }

  return purged;
}
