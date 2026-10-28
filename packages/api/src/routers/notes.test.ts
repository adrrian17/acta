import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { TRASH_RETENTION_MS } from "../notes/lifecycle";
import { createOwnerCaller } from "../test/caller";

type Caller = Awaited<ReturnType<typeof createOwnerCaller>>["caller"];

const START = new Date("2026-10-27T12:00:00Z");

function at(minutes: number) {
  vi.setSystemTime(START.getTime() + minutes * 60_000);
}

async function listAll(
  caller: Caller,
  input: Parameters<Caller["notes"]["list"]>[0]
) {
  const ids: string[] = [];
  let cursor: string | undefined;

  do {
    // oxlint-disable-next-line no-await-in-loop -- each page needs the previous page's cursor
    const page = await caller.notes.list({ ...input, cursor });
    ids.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);

  return ids;
}

let caller: Caller;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  at(0);
  ({ caller } = await createOwnerCaller());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("create and update", () => {
  it("creates a Note with its Tags at version 1", async () => {
    const note = await caller.notes.create({
      content: "Hoy #Ideas y #ideas/libros",
    });

    expect(note).toMatchObject({
      content: "Hoy #Ideas y #ideas/libros",
      state: "timeline",
      pinned: false,
      version: 1,
      tags: ["ideas", "ideas/libros"],
      trashedAt: null,
      purgeAt: null,
    });
  });

  it("rejects empty, whitespace-only and too long content (AC 6)", async () => {
    for (const content of ["", "  \n ", "a".repeat(100_001)]) {
      // oxlint-disable-next-line no-await-in-loop -- one assertion per case
      await expect(caller.notes.create({ content })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
  });

  it("never treats emptying a Note as a delete (AC 6)", async () => {
    const note = await caller.notes.create({ content: "#a" });
    await expect(
      caller.notes.update({ id: note.id, version: 1, content: " " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await caller.notes.get({ id: note.id })).toEqual(note);
  });

  it("replaces the Tags and bumps the version", async () => {
    const note = await caller.notes.create({ content: "#a" });

    const updated = await caller.notes.update({
      id: note.id,
      version: 1,
      content: "#b #b/c",
    });

    expect(updated).toMatchObject({ version: 2, tags: ["b", "b/c"] });
  });

  it("rejects the second of two saves from the same version (AC 19, 20)", async () => {
    const note = await caller.notes.create({ content: "#a" });
    await caller.notes.update({ id: note.id, version: 1, content: "#b" });

    await expect(
      caller.notes.update({ id: note.id, version: 1, content: "#c" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await caller.notes.get({ id: note.id })).toMatchObject({
      content: "#b",
      version: 2,
      tags: ["b"],
    });
  });

  it("returns NOT_FOUND for a Note that does not exist", async () => {
    await expect(
      caller.notes.update({ id: "missing", version: 1, content: "x" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.notes.get({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("lifecycle", () => {
  it("archives, unarchives, trashes and restores, bumping the version each time (AC 1, 22)", async () => {
    const { id } = await caller.notes.create({ content: "x" });
    const archived = await caller.notes.archive({ id, version: 1 });
    const unarchived = await caller.notes.unarchive({ id, version: 2 });
    const trashed = await caller.notes.trash({ id, version: 3 });
    const restored = await caller.notes.restore({ id, version: 4 });

    expect(
      [archived, unarchived, trashed, restored].map((n) => [n.state, n.version])
    ).toEqual([
      ["archived", 2],
      ["timeline", 3],
      ["trashed", 4],
      ["timeline", 5],
    ]);
  });

  it("rejects a disallowed transition and changes nothing (AC 2)", async () => {
    const note = await caller.notes.create({ content: "x" });
    await expect(
      caller.notes.unarchive({ id: note.id, version: 1 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      caller.notes.restore({ id: note.id, version: 1 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await caller.notes.get({ id: note.id })).toEqual(note);
  });

  it("restores a Note to where it was trashed from (AC 3)", async () => {
    const { id } = await caller.notes.create({ content: "x" });
    await caller.notes.archive({ id, version: 1 });
    await caller.notes.trash({ id, version: 2 });
    expect(await caller.notes.restore({ id, version: 3 })).toMatchObject({
      state: "archived",
      trashedAt: null,
    });
  });

  it("pins only Timeline Notes and unpins on archive (AC 4)", async () => {
    const { id } = await caller.notes.create({ content: "x" });

    const pinned = await caller.notes.setPinned({
      id,
      version: 1,
      pinned: true,
    });

    expect(pinned).toMatchObject({ pinned: true, version: 2 });

    const archived = await caller.notes.archive({ id, version: 2 });
    expect(archived.pinned).toBe(false);
    await expect(
      caller.notes.setPinned({ id, version: 3, pinned: true })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    const unarchived = await caller.notes.unarchive({ id, version: 3 });
    expect(unarchived.pinned).toBe(false);
  });

  it("rejects a lifecycle write from a stale version (AC 22)", async () => {
    const { id } = await caller.notes.create({ content: "x" });
    await caller.notes.setPinned({ id, version: 1, pinned: true });
    await expect(
      caller.notes.archive({ id, version: 1 })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("deletes only Trashed Notes permanently", async () => {
    const { id } = await caller.notes.create({ content: "#a" });
    await expect(caller.notes.deletePermanently({ id })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });

    await caller.notes.trash({ id, version: 1 });
    expect(await caller.notes.deletePermanently({ id })).toEqual({ id });
    await expect(caller.notes.get({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.notes.deletePermanently({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("list", () => {
  it("lists Pinned first, then newest created, and editing does not move a Note (AC 13)", async () => {
    const first = await caller.notes.create({ content: "first" });
    at(1);
    const second = await caller.notes.create({ content: "second" });
    at(2);
    const third = await caller.notes.create({ content: "third" });
    await caller.notes.setPinned({ id: first.id, version: 1, pinned: true });
    await caller.notes.update({ id: second.id, version: 1, content: "edited" });

    expect(await listAll(caller, { view: "timeline" })).toEqual([
      first.id,
      third.id,
      second.id,
    ]);
  });

  it("pages through every Note exactly once, with equal timestamps and Pinned Notes across pages (AC 14)", async () => {
    const ids: string[] = [];

    for (let index = 0; index < 7; index += 1) {
      // oxlint-disable-next-line no-await-in-loop -- creation order is the point
      const created = await caller.notes.create({ content: `n${index}` });
      ids.push(created.id);
    }

    for (const id of ids.slice(0, 3)) {
      // oxlint-disable-next-line no-await-in-loop -- sequential writes
      await caller.notes.setPinned({ id, version: 1, pinned: true });
    }

    const pages = await listAll(caller, { view: "timeline", limit: 2 });
    const single = await listAll(caller, { view: "timeline", limit: 100 });
    expect(pages).toEqual(single);
    expect(new Set(pages).size).toBe(7);
  });

  it("filters by a Tag and its descendants only (AC 9)", async () => {
    const parent = await caller.notes.create({ content: "#ideas" });
    const child = await caller.notes.create({ content: "#ideas/libros" });
    await caller.notes.create({ content: "#ideasx" });
    const archived = await caller.notes.create({ content: "#ideas" });
    await caller.notes.archive({ id: archived.id, version: 1 });

    const ids = await listAll(caller, { view: "timeline", tag: "Ideas" });
    expect(ids.toSorted()).toEqual([parent.id, child.id].toSorted());
  });

  it("filters untagged Notes (AC 15)", async () => {
    const plain = await caller.notes.create({ content: "no tags `#code`" });
    await caller.notes.create({ content: "#a" });
    expect(await listAll(caller, { view: "timeline", untagged: true })).toEqual(
      [plain.id]
    );
  });

  it("lists the Archive newest created and the Trash most recently trashed (AC 16)", async () => {
    const older = await caller.notes.create({ content: "older" });
    at(1);
    const newer = await caller.notes.create({ content: "newer" });
    await caller.notes.archive({ id: older.id, version: 1 });
    await caller.notes.archive({ id: newer.id, version: 1 });
    expect(await listAll(caller, { view: "archived" })).toEqual([
      newer.id,
      older.id,
    ]);

    at(5);
    await caller.notes.trash({ id: newer.id, version: 2 });
    at(6);
    const trashed = await caller.notes.trash({ id: older.id, version: 2 });
    expect(await listAll(caller, { view: "trashed", limit: 1 })).toEqual([
      older.id,
      newer.id,
    ]);
    expect(trashed.purgeAt).toBe(
      START.getTime() + 6 * 60_000 + TRASH_RETENTION_MS
    );
  });

  it("rejects invalid filters and cursors", async () => {
    const cases = [
      { view: "timeline", tag: "a", untagged: true },
      { view: "archived", tag: "a" },
      { view: "trashed", untagged: true },
      { view: "timeline", tag: "2026" },
      { view: "timeline", cursor: "garbage" },
    ] as const;

    for (const input of cases) {
      // oxlint-disable-next-line no-await-in-loop -- one assertion per case
      await expect(caller.notes.list(input)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
  });
});

describe("counts", () => {
  it("counts Notes per state, with zero for empty states", async () => {
    expect(await caller.notes.counts()).toEqual({
      timeline: 0,
      archived: 0,
      trashed: 0,
    });

    const [a, b, c] = await Promise.all([
      caller.notes.create({ content: "a" }),
      caller.notes.create({ content: "b" }),
      caller.notes.create({ content: "c" }),
    ]);

    await caller.notes.archive({ id: a.id, version: 1 });
    await caller.notes.trash({ id: b.id, version: 1 });

    expect(c.state).toBe("timeline");
    expect(await caller.notes.counts()).toEqual({
      timeline: 1,
      archived: 1,
      trashed: 1,
    });
  });
});
