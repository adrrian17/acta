import { task } from "@acta/db/schema/tasks";

export const TASK_STATES = task.state.enumValues;

export type TaskState = (typeof TASK_STATES)[number];

export const TRANSITIONS = ["markDone", "reopen", "trash", "restore"] as const;

export type Transition = (typeof TRANSITIONS)[number];

export interface LifecycleFields {
  state: TaskState;
  stateBeforeTrash: Exclude<TaskState, "trashed"> | null;
  doneAt: Date | null;
  trashedAt: Date | null;
}

/** The fields after `transition`, or `null` when the spec does not allow it from `current`. */
export function applyTransition(
  current: LifecycleFields,
  transition: Transition,
  now: Date
): LifecycleFields | null {
  switch (transition) {
    case "markDone": {
      return current.state === "open"
        ? { ...current, state: "done", doneAt: now }
        : null;
    }

    case "reopen": {
      return current.state === "done"
        ? { ...current, state: "open", doneAt: null }
        : null;
    }

    case "trash": {
      return current.state === "trashed"
        ? null
        : {
            ...current,
            state: "trashed",
            stateBeforeTrash: current.state,
            trashedAt: now,
          };
    }

    // A Task trashed from Done keeps its doneAt, so it comes back exactly as it was.
    case "restore": {
      return current.state === "trashed"
        ? {
            ...current,
            state: current.stateBeforeTrash ?? "open",
            stateBeforeTrash: null,
            trashedAt: null,
          }
        : null;
    }

    default: {
      return null;
    }
  }
}

/** Done and Trashed Tasks are read-only; only an Open Task's title or Due date can change. */
export function canEdit(state: TaskState): boolean {
  return state === "open";
}
