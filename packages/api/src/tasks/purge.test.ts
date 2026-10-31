import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { createOwnerCaller } from "../test/caller";
import { purgeTrashedTasks } from "./purge";

const NOW = new Date("2026-10-29T03:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("purgeTrashedTasks", () => {
  it("deletes Tasks trashed 30 days ago, keeps those trashed 29 days ago and never purges Done (AC 6)", async () => {
    const { db, caller } = await createOwnerCaller();
    vi.setSystemTime(NOW.getTime() - 60 * DAY_MS);
    const done = await caller.tasks.create({ title: "done" });
    await caller.tasks.markDone({ id: done.id, version: 1 });

    vi.setSystemTime(NOW.getTime() - 30 * DAY_MS);
    const expired = await caller.tasks.create({ title: "expired" });
    await caller.tasks.trash({ id: expired.id, version: 1 });

    vi.setSystemTime(NOW.getTime() - 29 * DAY_MS);
    const recent = await caller.tasks.create({ title: "recent" });
    await caller.tasks.trash({ id: recent.id, version: 1 });

    expect(await purgeTrashedTasks(db, NOW)).toBe(1);

    const trashed = await caller.tasks.list({ view: "trashed" });
    expect(trashed.items.map((task) => task.title)).toEqual(["recent"]);
    const doneView = await caller.tasks.list({ view: "done" });
    expect(doneView.items.map((task) => task.title)).toEqual(["done"]);
  });

  it("deletes exactly at the boundary", async () => {
    const { db, caller } = await createOwnerCaller();
    vi.setSystemTime(NOW.getTime() - 30 * DAY_MS);
    const task = await caller.tasks.create({ title: "x" });
    await caller.tasks.trash({ id: task.id, version: 1 });

    expect(await purgeTrashedTasks(db, new Date(NOW.getTime() - 1))).toBe(0);
    expect(await purgeTrashedTasks(db, NOW)).toBe(1);
  });
});
