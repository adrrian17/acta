import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { createOwnerCaller } from "../test/caller";
import { TRASH_RETENTION_MS } from "./lifecycle";
import { purgeTrashedNotes } from "./purge";

const NOW = new Date("2026-10-27T03:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("purgeTrashedNotes", () => {
  it("deletes Notes trashed 30 days ago and keeps those trashed 29 days ago (AC 5)", async () => {
    const { db, caller } = await createOwnerCaller();
    vi.setSystemTime(NOW.getTime() - 30 * DAY_MS);
    const expired = await caller.notes.create({ content: "#old" });
    await caller.notes.trash({ id: expired.id, version: 1 });

    vi.setSystemTime(NOW.getTime() - 29 * DAY_MS);
    const recent = await caller.notes.create({ content: "#recent" });
    await caller.notes.trash({ id: recent.id, version: 1 });
    const kept = await caller.notes.create({ content: "#kept" });

    expect(await purgeTrashedNotes(db, NOW)).toBe(1);
    await expect(caller.notes.get({ id: expired.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.notes.get({ id: recent.id })).resolves.toMatchObject({
      state: "trashed",
    });
    await expect(caller.notes.get({ id: kept.id })).resolves.toMatchObject({
      state: "timeline",
    });
  });

  it("deletes exactly at the boundary", async () => {
    const { db, caller } = await createOwnerCaller();
    vi.setSystemTime(NOW.getTime() - TRASH_RETENTION_MS);
    const note = await caller.notes.create({ content: "x" });
    await caller.notes.trash({ id: note.id, version: 1 });

    expect(await purgeTrashedNotes(db, new Date(NOW.getTime() - 1))).toBe(0);
    expect(await purgeTrashedNotes(db, NOW)).toBe(1);
  });
});
