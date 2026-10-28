import { describe, expect, it } from "vite-plus/test";

import {
  decodeCursor,
  encodeCursor,
  timelineCursor,
  trashCursor,
} from "./cursor";

describe("cursor", () => {
  it("round-trips a Timeline key", () => {
    const key = { pinned: true, createdAt: 1_761_571_200_000, id: "a-b" };
    expect(decodeCursor(encodeCursor(key), timelineCursor)).toEqual(key);
  });

  it("round-trips a Trash key", () => {
    const key = { trashedAt: 1_761_571_200_000, id: "a-b" };
    expect(decodeCursor(encodeCursor(key), trashCursor)).toEqual(key);
  });

  it("is URL-safe", () => {
    const key = { trashedAt: 1, id: "??>>??>>" };
    expect(encodeCursor(key)).toMatch(/^[\w-]+$/u);
  });

  it("rejects garbage", () => {
    expect(decodeCursor("not a cursor!", timelineCursor)).toBeNull();
    expect(decodeCursor(btoa("{oops"), timelineCursor)).toBeNull();
  });

  it("rejects a cursor from the other view", () => {
    const trash = encodeCursor({ trashedAt: 1, id: "x" });
    expect(decodeCursor(trash, timelineCursor)).toBeNull();
  });
});
