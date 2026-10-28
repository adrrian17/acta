import { describe, expect, it } from "vite-plus/test";

import {
  applyTransition,
  canSetPinned,
  purgeAt,
  TRASH_RETENTION_MS,
} from "./lifecycle";
import type { LifecycleFields, NoteState, Transition } from "./lifecycle";

const NOW = new Date("2026-10-27T12:00:00Z");

const NOTES = {
  timeline: {
    state: "timeline",
    stateBeforeTrash: null,
    pinned: false,
    trashedAt: null,
  },
  pinned: {
    state: "timeline",
    stateBeforeTrash: null,
    pinned: true,
    trashedAt: null,
  },
  archived: {
    state: "archived",
    stateBeforeTrash: null,
    pinned: false,
    trashedAt: null,
  },
  trashedFromTimeline: {
    state: "trashed",
    stateBeforeTrash: "timeline",
    pinned: false,
    trashedAt: NOW,
  },
  trashedFromArchive: {
    state: "trashed",
    stateBeforeTrash: "archived",
    pinned: false,
    trashedAt: NOW,
  },
} satisfies Record<string, LifecycleFields>;

// Every (note, transition) pair: the expected resulting state, or null when not allowed.
const MATRIX: [keyof typeof NOTES, Transition, NoteState | null][] = [
  ["timeline", "archive", "archived"],
  ["timeline", "unarchive", null],
  ["timeline", "trash", "trashed"],
  ["timeline", "restore", null],
  ["pinned", "archive", "archived"],
  ["pinned", "unarchive", null],
  ["pinned", "trash", "trashed"],
  ["pinned", "restore", null],
  ["archived", "archive", null],
  ["archived", "unarchive", "timeline"],
  ["archived", "trash", "trashed"],
  ["archived", "restore", null],
  ["trashedFromTimeline", "archive", null],
  ["trashedFromTimeline", "unarchive", null],
  ["trashedFromTimeline", "trash", null],
  ["trashedFromTimeline", "restore", "timeline"],
  ["trashedFromArchive", "archive", null],
  ["trashedFromArchive", "unarchive", null],
  ["trashedFromArchive", "trash", null],
  ["trashedFromArchive", "restore", "archived"],
];

describe("applyTransition", () => {
  it.each(MATRIX)("%s → %s gives %s", (from, transition, expected) => {
    expect(applyTransition(NOTES[from], transition, NOW)?.state ?? null).toBe(
      expected
    );
  });

  it("records where a Note was trashed from, and when", () => {
    expect(applyTransition(NOTES.archived, "trash", NOW)).toEqual({
      state: "trashed",
      stateBeforeTrash: "archived",
      pinned: false,
      trashedAt: NOW,
    });
  });

  it("clears the trash fields on restore", () => {
    expect(applyTransition(NOTES.trashedFromArchive, "restore", NOW)).toEqual({
      state: "archived",
      stateBeforeTrash: null,
      pinned: false,
      trashedAt: null,
    });
  });

  it("unpins on archive and trash, and unarchive does not re-pin", () => {
    const archived = applyTransition(NOTES.pinned, "archive", NOW);
    expect(archived?.pinned).toBe(false);
    expect(applyTransition(NOTES.pinned, "trash", NOW)?.pinned).toBe(false);
    expect(
      archived && applyTransition(archived, "unarchive", NOW)?.pinned
    ).toBe(false);
  });
});

describe("canSetPinned", () => {
  it("pins only Timeline Notes", () => {
    expect(canSetPinned("timeline", true)).toBe(true);
    expect(canSetPinned("archived", true)).toBe(false);
    expect(canSetPinned("trashed", true)).toBe(false);
  });

  it("always allows unpinning", () => {
    expect(canSetPinned("archived", false)).toBe(true);
  });
});

describe("purgeAt", () => {
  it("is 30 days after trashing", () => {
    expect(purgeAt(NOW)?.getTime()).toBe(NOW.getTime() + TRASH_RETENTION_MS);
  });

  it("is null for a Note that is not Trashed", () => {
    expect(purgeAt(null)).toBeNull();
  });
});
