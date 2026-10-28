import { describe, expect, it } from "vite-plus/test";

import { relativeTime } from "./relative-time";

const NOW = Date.UTC(2026, 9, 27, 12);
const MINUTE = 60_000;

describe("relativeTime", () => {
  it("falls back to seconds under a minute", () => {
    expect(relativeTime(NOW - 5000, NOW)).toBe("5 seconds ago");
  });

  it("picks the largest whole unit", () => {
    expect(relativeTime(NOW - 21 * MINUTE, NOW)).toBe("21 minutes ago");
    expect(relativeTime(NOW - 3 * 60 * MINUTE, NOW)).toBe("3 hours ago");
    expect(relativeTime(NOW - 24 * 60 * MINUTE, NOW)).toBe("yesterday");
    expect(relativeTime(NOW - 400 * 24 * 60 * MINUTE, NOW)).toBe("last year");
  });
});
