import { TRPCError } from "@trpc/server";
import { z } from "zod";

const MAX_PAGE_SIZE = 100;

export function pageLimit(defaultSize: number) {
  return z.int().min(1).max(MAX_PAGE_SIZE).default(defaultSize);
}

export type CursorKey = Readonly<
  Record<string, string | number | boolean | null>
>;

// The key holds only ASCII (ids, numbers, booleans, YYYY-MM-DD dates), so btoa is safe.
export function encodeCursor(key: CursorKey): string {
  return btoa(JSON.stringify(key))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** The decoded key; a cursor this schema did not produce is a BAD_REQUEST. */
export function decodeCursor<T>(cursor: string, schema: z.ZodType<T>): T {
  try {
    const parsed = schema.safeParse(
      JSON.parse(atob(cursor.replaceAll("-", "+").replaceAll("_", "/")))
    );

    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Not base64 or not JSON: rejected below like a cursor from another view.
  }

  throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
}

/** One page from `limit + 1` rows: the extra row only says whether another page exists. */
export function toPage<Row, Item>(
  rows: readonly Row[],
  limit: number,
  toItem: (row: Row) => Item,
  keyOf: (item: Item) => CursorKey
) {
  const items = rows.slice(0, limit).map(toItem);
  const last = items.at(-1);

  return {
    items,
    nextCursor:
      rows.length > limit && last !== undefined
        ? encodeCursor(keyOf(last))
        : null,
  };
}
