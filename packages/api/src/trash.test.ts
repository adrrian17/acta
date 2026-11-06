import { describe, expect, it } from "vite-plus/test";

import { purgeAt } from "./trash";

describe("purgeAt", () => {
  it("is 30 days after trashing", () => {
    const trashedAt = new Date("2026-10-27T12:00:00Z");
    expect(purgeAt(trashedAt)).toEqual(new Date("2026-11-26T12:00:00Z"));
  });

  it("is null for a row that is not Trashed", () => {
    expect(purgeAt(null)).toBeNull();
  });
});
