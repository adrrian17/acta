import { z } from "zod";

/** Sort key of the last row in the Open view; a `null` dueDate sorts after every date. */
export const openCursor = z.object({
  dueDate: z.iso.date().nullable(),
  createdAt: z.int(),
  id: z.string(),
});

/** Sort key of the last row in the Done view. The Trash reuses `trashCursor` from notes. */
export const doneCursor = z.object({
  doneAt: z.int(),
  id: z.string(),
});
