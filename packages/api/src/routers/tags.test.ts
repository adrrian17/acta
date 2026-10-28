import { beforeEach, describe, expect, it } from "vite-plus/test";

import { NOTE_MAX_CHARS } from "../notes/content";
import { createOwnerCaller } from "../test/caller";

type Caller = Awaited<ReturnType<typeof createOwnerCaller>>["caller"];

let caller: Caller;

beforeEach(async () => {
  ({ caller } = await createOwnerCaller());
});

async function createArchived(content: string) {
  const { id } = await caller.notes.create({ content });

  return await caller.notes.archive({ id, version: 1 });
}

async function createTrashed(content: string) {
  const { id } = await caller.notes.create({ content });

  return await caller.notes.trash({ id, version: 1 });
}

describe("tree", () => {
  it("counts distinct Timeline and Archived Notes per node, with intermediate levels (AC 17, 18)", async () => {
    await caller.notes.create({ content: "#a/b/c" });
    await caller.notes.create({ content: "#a #a/x" });
    await createArchived("#a/b");
    await createTrashed("#z #a");
    await caller.notes.create({ content: "untagged" });
    await createArchived("also untagged");
    await createTrashed("trashed untagged");

    expect(await caller.tags.tree()).toEqual({
      untaggedCount: 2,
      nodes: [
        {
          name: "a",
          path: "a",
          count: 3,
          children: [
            {
              name: "b",
              path: "a/b",
              count: 2,
              children: [{ name: "c", path: "a/b/c", count: 1, children: [] }],
            },
            { name: "x", path: "a/x", count: 1, children: [] },
          ],
        },
      ],
    });
  });
});

describe("rename", () => {
  it("rewrites Timeline and Archived Notes, never Trashed ones (AC 10, 22)", async () => {
    const timeline = await caller.notes.create({
      content: "Uno #Ideas/Libros y #ideasx",
    });

    const archived = await createArchived("#ideas");
    const trashed = await createTrashed("#ideas");

    expect(await caller.tags.rename({ from: "Ideas", to: "thoughts" })).toEqual(
      { changed: 2, skipped: 0 }
    );

    expect(await caller.notes.get({ id: timeline.id })).toMatchObject({
      content: "Uno #thoughts/Libros y #ideasx",
      tags: ["ideasx", "thoughts/libros"],
      version: 2,
    });
    expect(await caller.notes.get({ id: archived.id })).toMatchObject({
      content: "#thoughts",
      version: 3,
    });
    expect(await caller.notes.get({ id: trashed.id })).toEqual(trashed);
  });

  it("merges onto an existing Tag", async () => {
    await caller.notes.create({ content: "#a" });
    await caller.notes.create({ content: "#b" });
    await caller.tags.rename({ from: "a", to: "b" });
    const { nodes } = await caller.tags.tree();
    expect(nodes).toEqual([{ name: "b", path: "b", count: 2, children: [] }]);
  });

  it("rejects renaming to itself or a descendant", async () => {
    await caller.notes.create({ content: "#a" });
    await expect(
      caller.tags.rename({ from: "a", to: "a/b" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.tags.rename({ from: "a", to: "A" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns NOT_FOUND when no Timeline or Archived Note has the Tag", async () => {
    await createTrashed("#a");
    await expect(
      caller.tags.rename({ from: "a", to: "b" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("skips a Note it would push over the limit (AC 12)", async () => {
    const long = await caller.notes.create({
      content: `${"x".repeat(NOTE_MAX_CHARS - 3)} #a`,
    });

    const short = await caller.notes.create({ content: "#a" });

    expect(await caller.tags.rename({ from: "a", to: "abc" })).toEqual({
      changed: 1,
      skipped: 1,
    });
    expect(await caller.notes.get({ id: long.id })).toEqual(long);
    const renamed = await caller.notes.get({ id: short.id });
    expect(renamed.content).toBe("#abc");
  });
});

describe("delete", () => {
  it("removes the Tag and its descendants, keeping the words (AC 11)", async () => {
    const note = await caller.notes.create({
      content: "uno #ideas dos #ideas/libros",
    });

    const trashed = await createTrashed("#ideas");

    expect(await caller.tags.delete({ tag: "ideas" })).toEqual({
      changed: 1,
      skipped: 0,
    });
    expect(await caller.notes.get({ id: note.id })).toMatchObject({
      content: "uno dos",
      tags: [],
      version: 2,
    });
    expect(await caller.notes.get({ id: trashed.id })).toEqual(trashed);
  });

  it("skips a Note it would leave empty (AC 12)", async () => {
    const onlyTag = await caller.notes.create({ content: " #a " });
    await caller.notes.create({ content: "x #a" });

    expect(await caller.tags.delete({ tag: "a" })).toEqual({
      changed: 1,
      skipped: 1,
    });
    expect(await caller.notes.get({ id: onlyTag.id })).toEqual(onlyTag);
  });
});
