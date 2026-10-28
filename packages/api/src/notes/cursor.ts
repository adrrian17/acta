import { z } from "zod";

/** Sort key of the last row in the Timeline or Archive. */
export const timelineCursor = z.object({
  pinned: z.boolean(),
  createdAt: z.int(),
  id: z.string(),
});

/** Sort key of the last row in the Trash. */
export const trashCursor = z.object({
  trashedAt: z.int(),
  id: z.string(),
});

// The key holds only ASCII (ids, numbers, booleans), so btoa is safe.
export function encodeCursor(
  key: z.infer<typeof timelineCursor> | z.infer<typeof trashCursor>
): string {
  return btoa(JSON.stringify(key))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** The decoded key, or `null` when the cursor is not one this schema produced. */
export function decodeCursor<T>(
  cursor: string,
  schema: z.ZodType<T>
): T | null {
  try {
    const json = atob(cursor.replaceAll("-", "+").replaceAll("_", "/"));
    const parsed = schema.safeParse(JSON.parse(json));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
