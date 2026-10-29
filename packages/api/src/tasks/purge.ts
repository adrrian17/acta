import type { Database } from "@acta/db";
import { task } from "@acta/db/schema/tasks";
import { and, eq, inArray, lte } from "drizzle-orm";

import { TRASH_RETENTION_MS } from "../notes/lifecycle";

// Bounds each DELETE so a large backlog never runs as one long statement.
const PURGE_BATCH_SIZE = 500;

/** Permanently deletes Tasks trashed at least 30 days before `now`. Done Tasks are never purged. Returns how many. */
export async function purgeTrashedTasks(
  db: Database,
  now: Date
): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_MS);

  const expired = db
    .select({ id: task.id })
    .from(task)
    .where(and(eq(task.state, "trashed"), lte(task.trashedAt, cutoff)))
    .limit(PURGE_BATCH_SIZE);

  let purged = 0;
  let changes = PURGE_BATCH_SIZE;

  while (changes === PURGE_BATCH_SIZE) {
    // oxlint-disable-next-line no-await-in-loop -- each batch depends on the previous one having deleted its rows
    const result = await db.delete(task).where(inArray(task.id, expired));
    ({ changes } = result.meta);
    purged += changes;
  }

  return purged;
}
