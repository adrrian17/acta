import { describe, expect, it } from "vite-plus/test";

import { decodeCursor, encodeCursor, trashCursor } from "../notes/cursor";
import { doneCursor, openCursor } from "./cursor";

describe("task cursors", () => {
  it("round-trips an Open key with and without a Due date", () => {
    for (const dueDate of ["2026-10-29", null]) {
      const key = { dueDate, createdAt: 1_761_571_200_000, id: "a-b" };
      expect(decodeCursor(encodeCursor(key), openCursor)).toEqual(key);
    }
  });

  it("round-trips a Done key", () => {
    const key = { doneAt: 1_761_571_200_000, id: "a-b" };
    expect(decodeCursor(encodeCursor(key), doneCursor)).toEqual(key);
  });

  it("rejects a cursor from another view", () => {
    const trash = encodeCursor({ trashedAt: 1, id: "x" });
    expect(decodeCursor(trash, openCursor)).toBeNull();
    expect(decodeCursor(trash, doneCursor)).toBeNull();
    expect(
      decodeCursor(encodeCursor({ doneAt: 1, id: "x" }), trashCursor)
    ).toBeNull();
  });
});
