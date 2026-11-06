import { describe, expect, it } from "vite-plus/test";

import { timelineCursor } from "./notes/cursor";
import { decodeCursor, encodeCursor, toPage } from "./paging";
import { doneCursor, openCursor } from "./tasks/cursor";
import { trashCursor } from "./trash";

describe("cursor", () => {
  it("round-trips every view's key", () => {
    const at = 1_761_571_200_000;
    const timeline = { pinned: true, createdAt: at, id: "a-b" };
    const trash = { trashedAt: at, id: "a-b" };
    const done = { doneAt: at, id: "a-b" };
    const dated = { dueDate: "2026-10-29", createdAt: at, id: "a-b" };
    const undated = { dueDate: null, createdAt: at, id: "a-b" };

    expect(decodeCursor(encodeCursor(timeline), timelineCursor)).toEqual(
      timeline
    );
    expect(decodeCursor(encodeCursor(trash), trashCursor)).toEqual(trash);
    expect(decodeCursor(encodeCursor(done), doneCursor)).toEqual(done);
    expect(decodeCursor(encodeCursor(dated), openCursor)).toEqual(dated);
    expect(decodeCursor(encodeCursor(undated), openCursor)).toEqual(undated);
  });

  it("is URL-safe", () => {
    const key = { trashedAt: 1, id: "??>>??>>" };
    expect(encodeCursor(key)).toMatch(/^[\w-]+$/u);
  });

  it("rejects garbage as a bad request", () => {
    for (const cursor of ["not a cursor!", btoa("{oops")]) {
      expect(() => decodeCursor(cursor, timelineCursor)).toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" })
      );
    }
  });

  it("rejects a cursor from another view", () => {
    const trash = encodeCursor({ trashedAt: 1, id: "x" });
    expect(() => decodeCursor(trash, timelineCursor)).toThrow();
    expect(() => decodeCursor(trash, openCursor)).toThrow();
    expect(() => decodeCursor(trash, doneCursor)).toThrow();
    expect(() =>
      decodeCursor(encodeCursor({ doneAt: 1, id: "x" }), trashCursor)
    ).toThrow();
  });
});

function keyOf(item: number) {
  return { id: String(item) };
}

describe("toPage", () => {
  it("has a next cursor only when a row beyond the limit came back", () => {
    expect(toPage([1, 2, 3], 2, (row) => row, keyOf)).toEqual({
      items: [1, 2],
      nextCursor: encodeCursor({ id: "2" }),
    });
    expect(toPage([1, 2], 2, (row) => row, keyOf)).toEqual({
      items: [1, 2],
      nextCursor: null,
    });
  });
});
