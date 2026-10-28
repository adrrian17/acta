import { describe, expect, it } from "vite-plus/test";

import { chunk } from "./chunk";

describe("chunk", () => {
  it("returns no chunks for an empty list", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("splits an exact multiple into full chunks", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("keeps the remainder in a last, shorter chunk", () => {
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });
});
