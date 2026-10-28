import { createDb } from "@acta/db";
import { note, noteTag } from "@acta/db/schema/notes";
import { count, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import { createTestD1 } from "./d1";

const NOW = new Date("2026-10-27T12:00:00Z");

function insertNote(db: ReturnType<typeof createDb>, id: string) {
  return db
    .insert(note)
    .values({ id, content: "#a", createdAt: NOW, updatedAt: NOW });
}

describe("createTestD1", () => {
  it("applies the migrations and round-trips typed columns", async () => {
    const db = createDb({ DB: createTestD1() });
    await insertNote(db, "n1");

    const row = await db.query.note.findFirst({ where: { id: "n1" } });
    expect(row).toMatchObject({
      state: "timeline",
      pinned: false,
      version: 1,
      createdAt: NOW,
    });
  });

  it("cascades note_tag rows when a note is deleted", async () => {
    const db = createDb({ DB: createTestD1() });
    await insertNote(db, "n1");
    await db.insert(noteTag).values({ noteId: "n1", tag: "a" });

    await db.delete(note).where(eq(note.id, "n1"));

    const [tags] = await db.select({ total: count() }).from(noteTag);
    expect(tags?.total).toBe(0);
  });

  it("reports changed rows", async () => {
    const db = createDb({ DB: createTestD1() });
    await insertNote(db, "n1");

    const result = await db
      .update(note)
      .set({ version: sql`${note.version} + 1` })
      .where(eq(note.id, "n1"));

    expect(result.meta.changes).toBe(1);
  });

  it("rolls back the whole batch when one statement fails", async () => {
    const db = createDb({ DB: createTestD1() });

    await expect(
      db.batch([
        insertNote(db, "n1"),
        db.insert(noteTag).values({ noteId: "missing", tag: "a" }),
      ])
    ).rejects.toThrow();

    const [notes] = await db.select({ total: count() }).from(note);
    expect(notes?.total).toBe(0);
  });
});
