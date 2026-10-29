import { describe, expect, it } from "vite-plus/test";

import { applyTransition, canEdit, TASK_STATES } from "./lifecycle";
import type { LifecycleFields, TaskState, Transition } from "./lifecycle";

const DONE_AT = new Date("2026-10-20T12:00:00Z");
const NOW = new Date("2026-10-29T12:00:00Z");

const TASKS = {
  open: {
    state: "open",
    stateBeforeTrash: null,
    doneAt: null,
    trashedAt: null,
  },
  done: {
    state: "done",
    stateBeforeTrash: null,
    doneAt: DONE_AT,
    trashedAt: null,
  },
  trashedFromOpen: {
    state: "trashed",
    stateBeforeTrash: "open",
    doneAt: null,
    trashedAt: DONE_AT,
  },
  trashedFromDone: {
    state: "trashed",
    stateBeforeTrash: "done",
    doneAt: DONE_AT,
    trashedAt: DONE_AT,
  },
} satisfies Record<string, LifecycleFields>;

// Every (task, transition) pair: the expected resulting state, or null when not allowed (AC 2).
const MATRIX: [keyof typeof TASKS, Transition, TaskState | null][] = [
  ["open", "markDone", "done"],
  ["open", "reopen", null],
  ["open", "trash", "trashed"],
  ["open", "restore", null],
  ["done", "markDone", null],
  ["done", "reopen", "open"],
  ["done", "trash", "trashed"],
  ["done", "restore", null],
  ["trashedFromOpen", "markDone", null],
  ["trashedFromOpen", "reopen", null],
  ["trashedFromOpen", "trash", null],
  ["trashedFromOpen", "restore", "open"],
  ["trashedFromDone", "markDone", null],
  ["trashedFromDone", "reopen", null],
  ["trashedFromDone", "trash", null],
  ["trashedFromDone", "restore", "done"],
];

describe("applyTransition", () => {
  it.each(MATRIX)("%s + %s → %s", (from, transition, expected) => {
    expect(applyTransition(TASKS[from], transition, NOW)?.state ?? null).toBe(
      expected
    );
  });

  it("sets doneAt on markDone and clears it on reopen (AC 4)", () => {
    expect(applyTransition(TASKS.open, "markDone", NOW)?.doneAt).toBe(NOW);
    expect(applyTransition(TASKS.done, "reopen", NOW)?.doneAt).toBeNull();
  });

  it("remembers the state before trash and restores it with its doneAt (AC 3, 4)", () => {
    const trashed = applyTransition(TASKS.done, "trash", NOW);
    expect(trashed).toEqual({
      state: "trashed",
      stateBeforeTrash: "done",
      doneAt: DONE_AT,
      trashedAt: NOW,
    });
    expect(trashed && applyTransition(trashed, "restore", NOW)).toEqual(
      TASKS.done
    );
  });

  it("restores a Task trashed from Open to Open (AC 3)", () => {
    expect(applyTransition(TASKS.trashedFromOpen, "restore", NOW)).toEqual(
      TASKS.open
    );
  });
});

describe("canEdit", () => {
  it("allows editing only Open Tasks (AC 5)", () => {
    expect(TASK_STATES.filter(canEdit)).toEqual(["open"]);
  });
});
