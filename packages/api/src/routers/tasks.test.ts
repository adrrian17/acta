import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { createOwnerCaller } from "../test/caller";

type Caller = Awaited<ReturnType<typeof createOwnerCaller>>["caller"];

type View = Parameters<Caller["tasks"]["list"]>[0]["view"];

const START = new Date("2026-10-29T12:00:00Z");

function at(minutes: number) {
  vi.setSystemTime(START.getTime() + minutes * 60_000);
}

async function listAll(caller: Caller, view: View, limit?: number) {
  const titles: string[] = [];
  let cursor: string | undefined;

  do {
    // oxlint-disable-next-line no-await-in-loop -- each page needs the previous page's cursor
    const page = await caller.tasks.list({ view, cursor, limit });
    titles.push(...page.items.map((item) => item.title));
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);

  return titles;
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
  it("creates an Open Task at version 1, title untrimmed", async () => {
    const task = await caller.tasks.create({
      title: " Buy milk ",
      dueDate: "2026-11-01",
    });

    expect(task).toMatchObject({
      title: " Buy milk ",
      dueDate: "2026-11-01",
      state: "open",
      version: 1,
      doneAt: null,
      trashedAt: null,
      purgeAt: null,
    });
    const undated = await caller.tasks.create({ title: "x" });
    expect(undated.dueDate).toBeNull();
  });

  it("rejects bad titles and Due dates on create and edit (AC 7, 8)", async () => {
    const task = await caller.tasks.create({ title: "x" });

    for (const title of ["", "  ", "a\nb", "a".repeat(501)]) {
      // oxlint-disable-next-line no-await-in-loop -- one assertion per case
      await expect(caller.tasks.create({ title })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      // oxlint-disable-next-line no-await-in-loop -- one assertion per case
      await expect(
        caller.tasks.update({ id: task.id, version: 1, title, dueDate: null })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }

    for (const dueDate of ["2026-02-30", "2026-1-5"]) {
      // oxlint-disable-next-line no-await-in-loop -- one assertion per case
      await expect(
        caller.tasks.create({ title: "x", dueDate })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }

    expect(await listAll(caller, "open")).toEqual(["x"]);
  });

  it("accepts a past Due date and clears it with null (AC 8)", async () => {
    const task = await caller.tasks.create({
      title: "x",
      dueDate: "2020-01-01",
    });

    const cleared = await caller.tasks.update({
      id: task.id,
      version: 1,
      title: "x",
      dueDate: null,
    });

    expect(cleared).toMatchObject({ dueDate: null, version: 2 });
  });

  it("rejects the second of two saves from the same version (AC 13, 14)", async () => {
    const task = await caller.tasks.create({ title: "a" });
    const edit = { id: task.id, version: 1, dueDate: null };
    await caller.tasks.update({ ...edit, title: "b" });

    await expect(
      caller.tasks.update({ ...edit, title: "c" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller.tasks.markDone(edit)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await caller.tasks.get({ id: task.id })).toMatchObject({
      title: "b",
      version: 2,
    });
  });

  it("returns NOT_FOUND for a Task that does not exist", async () => {
    await expect(caller.tasks.get({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      caller.tasks.update({
        id: "missing",
        version: 1,
        title: "x",
        dueDate: null,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.tasks.trash({ id: "missing", version: 1 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.tasks.deletePermanently({ id: "missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("lifecycle", () => {
  it("marks done, reopens, trashes and restores, bumping the version each time (AC 1, 4, 16)", async () => {
    const { id } = await caller.tasks.create({ title: "x" });
    at(1);
    const done = await caller.tasks.markDone({ id, version: 1 });
    const reopened = await caller.tasks.reopen({ id, version: 2 });
    const trashed = await caller.tasks.trash({ id, version: 3 });
    const restored = await caller.tasks.restore({ id, version: 4 });

    expect(done.doneAt).toBe(START.getTime() + 60_000);
    expect(reopened.doneAt).toBeNull();
    expect(trashed.purgeAt).toBe(
      (trashed.trashedAt ?? 0) + 30 * 24 * 60 * 60 * 1000
    );
    expect(
      [done, reopened, trashed, restored].map((t) => [t.state, t.version])
    ).toEqual([
      ["done", 2],
      ["open", 3],
      ["trashed", 4],
      ["open", 5],
    ]);
  });

  it("restores a Task trashed from Done to Done with its doneAt (AC 3, 4)", async () => {
    const { id } = await caller.tasks.create({ title: "x" });
    const done = await caller.tasks.markDone({ id, version: 1 });
    at(5);
    await caller.tasks.trash({ id, version: 2 });
    const restored = await caller.tasks.restore({ id, version: 3 });

    expect(restored).toMatchObject({
      state: "done",
      doneAt: done.doneAt,
      trashedAt: null,
      purgeAt: null,
    });
    expect(await listAll(caller, "done")).toEqual(["x"]);
  });

  it("rejects a disallowed transition and changes nothing (AC 2)", async () => {
    const { id } = await caller.tasks.create({ title: "x" });

    for (const action of ["reopen", "restore"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- one assertion per case
      await expect(
        caller.tasks[action]({ id, version: 1 })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }

    await expect(caller.tasks.deletePermanently({ id })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    const open = await caller.tasks.list({ view: "open" });
    expect(open.items).toMatchObject([{ state: "open", version: 1 }]);
  });

  it("rejects editing a Done or Trashed Task (AC 5)", async () => {
    const { id } = await caller.tasks.create({ title: "x" });
    await caller.tasks.markDone({ id, version: 1 });
    const edit = { id, title: "y", dueDate: null };

    await expect(
      caller.tasks.update({ ...edit, version: 2 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    await caller.tasks.trash({ id, version: 2 });
    await expect(
      caller.tasks.update({ ...edit, version: 3 })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await listAll(caller, "trashed")).toEqual(["x"]);
  });

  it("deletes a Trashed Task permanently", async () => {
    const { id } = await caller.tasks.create({ title: "x" });
    await caller.tasks.trash({ id, version: 1 });

    expect(await caller.tasks.deletePermanently({ id })).toEqual({ id });
    expect(await listAll(caller, "trashed")).toEqual([]);
  });
});

describe("views", () => {
  it("orders Open by Due date, then undated, ties oldest first, across pages (AC 9, 11)", async () => {
    at(0);
    await caller.tasks.create({ title: "undated-1" });
    await caller.tasks.create({ title: "nov-2", dueDate: "2026-11-02" });
    at(1);
    await caller.tasks.create({ title: "undated-2" });
    await caller.tasks.create({ title: "nov-1-a", dueDate: "2026-11-01" });
    at(2);
    await caller.tasks.create({ title: "nov-1-b", dueDate: "2026-11-01" });
    await caller.tasks.create({ title: "oct-1", dueDate: "2025-10-01" });
    await caller.tasks.create({ title: "undated-3" });

    const all = await listAll(caller, "open");
    expect(all).toEqual([
      "oct-1",
      "nov-1-a",
      "nov-1-b",
      "nov-2",
      "undated-1",
      "undated-2",
      "undated-3",
    ]);

    for (const limit of [1, 2, 3]) {
      // oxlint-disable-next-line no-await-in-loop -- one assertion per page size
      expect(await listAll(caller, "open", limit)).toEqual(all);
    }
  });

  it("breaks createdAt ties by id so each Task appears exactly once (AC 11)", async () => {
    for (let index = 0; index < 5; index += 1) {
      // oxlint-disable-next-line no-await-in-loop -- sequential creates on one clock tick
      await caller.tasks.create({ title: `t${index}`, dueDate: "2026-11-01" });
      // oxlint-disable-next-line no-await-in-loop -- sequential creates on one clock tick
      await caller.tasks.create({ title: `u${index}` });
    }

    const paged = await listAll(caller, "open", 2);
    expect(paged).toEqual(await listAll(caller, "open", 100));
    expect(new Set(paged).size).toBe(10);
    expect(paged.slice(0, 5).every((title) => title.startsWith("t"))).toBe(
      true
    );
  });

  it("moves a Task when its Due date changes, not when its title does (AC 9)", async () => {
    const a = await caller.tasks.create({ title: "a", dueDate: "2026-11-01" });
    at(1);
    await caller.tasks.create({ title: "b", dueDate: "2026-11-02" });

    await caller.tasks.update({
      id: a.id,
      version: 1,
      title: "a2",
      dueDate: "2026-11-01",
    });
    expect(await listAll(caller, "open")).toEqual(["a2", "b"]);

    await caller.tasks.update({
      id: a.id,
      version: 2,
      title: "a2",
      dueDate: "2026-11-03",
    });
    expect(await listAll(caller, "open")).toEqual(["b", "a2"]);
  });

  it("lists Done by doneAt and Trash by trashedAt, most recent first (AC 10, 11)", async () => {
    const ids: string[] = [];

    for (const title of ["a", "b", "c"]) {
      // oxlint-disable-next-line no-await-in-loop -- sequential creates
      const { id } = await caller.tasks.create({ title });
      ids.push(id);
    }

    for (const [minute, id] of [ids[1], ids[0], ids[2]].entries()) {
      at(minute + 1);
      // oxlint-disable-next-line no-await-in-loop -- each mark needs its own clock tick
      await caller.tasks.markDone({ id: id ?? "", version: 1 });
    }

    expect(await listAll(caller, "done", 1)).toEqual(["c", "a", "b"]);

    for (const [minute, id] of [ids[2], ids[1]].entries()) {
      at(minute + 10);
      // oxlint-disable-next-line no-await-in-loop -- each trash needs its own clock tick
      await caller.tasks.trash({ id: id ?? "", version: 2 });
    }

    expect(await listAll(caller, "trashed", 1)).toEqual(["b", "c"]);
    expect(await listAll(caller, "done")).toEqual(["a"]);
  });

  it("rejects a cursor from another view", async () => {
    await caller.tasks.create({ title: "a" });
    await caller.tasks.create({ title: "b" });
    const { nextCursor } = await caller.tasks.list({ view: "open", limit: 1 });

    await expect(
      caller.tasks.list({ view: "done", cursor: nextCursor ?? "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
