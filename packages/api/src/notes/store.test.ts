import { describe, expect, it } from "vite-plus/test";

import { createOwnerCaller } from "../test/caller";
import { writeNotes } from "./store";

describe("writeNotes", () => {
  it("applies each write on its own version check within one batch", async () => {
    const { db, caller } = await createOwnerCaller();
    const fresh = await caller.notes.create({ content: "#a" });
    const stale = await caller.notes.create({ content: "#a" });
    await caller.notes.update({
      id: stale.id,
      version: 1,
      content: "#a moved",
    });

    const now = new Date();
    expect(
      await writeNotes(db, [
        {
          id: fresh.id,
          expectedVersion: 1,
          now,
          patch: { content: "#b" },
          tags: ["b"],
        },
        {
          id: stale.id,
          expectedVersion: 1,
          now,
          patch: { content: "#b" },
          tags: ["b"],
        },
      ])
    ).toEqual([true, false]);

    expect(await caller.notes.get({ id: fresh.id })).toMatchObject({
      content: "#b",
      tags: ["b"],
      version: 2,
    });
    expect(await caller.notes.get({ id: stale.id })).toMatchObject({
      content: "#a moved",
      tags: ["a"],
      version: 2,
    });
  });

  it("returns no outcomes for no writes", async () => {
    const { db } = await createOwnerCaller();
    expect(await writeNotes(db, [])).toEqual([]);
  });
});
