import { describe, expect, it } from "vite-plus/test";

import { TASK_TITLE_MAX_CHARS, taskDueDate, taskTitle } from "./title";

function titleError(value: string) {
  return taskTitle.safeParse(value).error?.issues[0]?.message ?? null;
}

describe("taskTitle (AC 7)", () => {
  it("accepts a title and keeps it untrimmed", () => {
    expect(taskTitle.parse("  Buy milk ")).toBe("  Buy milk ");
  });

  it("rejects empty and whitespace-only titles", () => {
    expect(titleError("")).toBe("empty");
    expect(titleError(" \t ")).toBe("empty");
  });

  it("rejects a line break", () => {
    expect(titleError("a\nb")).toBe("multiline");
    expect(titleError("a\r\nb")).toBe("multiline");
  });

  it("counts code points, not UTF-16 units", () => {
    expect(titleError("a".repeat(TASK_TITLE_MAX_CHARS))).toBeNull();
    expect(titleError("a".repeat(TASK_TITLE_MAX_CHARS + 1))).toBe("tooLong");
    expect(titleError("🙂".repeat(TASK_TITLE_MAX_CHARS))).toBeNull();
  });
});

describe("taskDueDate (AC 8)", () => {
  it("accepts real days, past days and null", () => {
    for (const value of ["2026-10-29", "2024-02-29", "1999-01-01", null]) {
      expect(taskDueDate.safeParse(value).success).toBe(true);
    }
  });

  it("rejects impossible or malformed days", () => {
    for (const value of [
      "2026-02-30",
      "2025-02-29",
      "2026-1-5",
      "2026-10-29T00:00",
      "",
    ]) {
      expect(taskDueDate.safeParse(value).success).toBe(false);
    }
  });
});
