import { describe, expect, it } from "vite-plus/test";

import { dueStatus, formatDay, localDay } from "./due-date";

describe("dueStatus (AC 12)", () => {
  it("compares against the local day", () => {
    expect(dueStatus("2026-10-28", "2026-10-29")).toBe("overdue");
    expect(dueStatus("2025-12-31", "2026-01-01")).toBe("overdue");
    expect(dueStatus("2026-10-29", "2026-10-29")).toBe("today");
    expect(dueStatus("2026-10-30", "2026-10-29")).toBe("upcoming");
  });
});

describe("localDay", () => {
  it("uses local time, not UTC", () => {
    const lateEvening = new Date(2026, 9, 29, 23, 59).getTime();
    expect(localDay(lateEvening)).toBe("2026-10-29");
    expect(localDay(new Date(2026, 0, 5, 0, 0).getTime())).toBe("2026-01-05");
  });
});

describe("formatDay", () => {
  it("keeps the calendar day", () => {
    expect(formatDay("2026-01-05")).toBe(
      new Date(2026, 0, 5).toLocaleDateString()
    );
  });
});
