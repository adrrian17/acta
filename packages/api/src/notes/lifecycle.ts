import { note } from "@acta/db/schema/notes";

export const NOTE_STATES = note.state.enumValues;

export type NoteState = (typeof NOTE_STATES)[number];

export type Transition = "archive" | "unarchive" | "trash" | "restore";

export interface LifecycleFields {
  state: NoteState;
  stateBeforeTrash: Exclude<NoteState, "trashed"> | null;
  pinned: boolean;
  trashedAt: Date | null;
}

const UNPINNED_TIMELINE: LifecycleFields = {
  state: "timeline",
  stateBeforeTrash: null,
  pinned: false,
  trashedAt: null,
};

/** The fields after `transition`, or `null` when the brief does not allow it from `current`. */
export function applyTransition(
  current: LifecycleFields,
  transition: Transition,
  now: Date
): LifecycleFields | null {
  switch (transition) {
    case "archive": {
      return current.state === "timeline"
        ? { ...UNPINNED_TIMELINE, state: "archived" }
        : null;
    }

    case "unarchive": {
      return current.state === "archived" ? UNPINNED_TIMELINE : null;
    }

    case "trash": {
      return current.state === "trashed"
        ? null
        : {
            state: "trashed",
            stateBeforeTrash: current.state,
            pinned: false,
            trashedAt: now,
          };
    }

    case "restore": {
      return current.state === "trashed"
        ? {
            ...UNPINNED_TIMELINE,
            state: current.stateBeforeTrash ?? "timeline",
          }
        : null;
    }

    default: {
      return null;
    }
  }
}

/** Only Timeline Notes can be Pinned; unpinning is always allowed. */
export function applyPinned(
  current: LifecycleFields,
  pinned: boolean
): Pick<LifecycleFields, "pinned"> | null {
  return !pinned || current.state === "timeline" ? { pinned } : null;
}
