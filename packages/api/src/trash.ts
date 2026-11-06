import { z } from "zod";

export const TRASH_RETENTION_DAYS = 30;

export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function purgeAt(trashedAt: Date | null): Date | null {
  return trashedAt && new Date(trashedAt.getTime() + TRASH_RETENTION_MS);
}

/** Sort key of the last row in a Trash view. */
export const trashCursor = z.object({
  trashedAt: z.int(),
  id: z.string(),
});
