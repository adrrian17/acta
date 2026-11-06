import { TASK_TITLE_MAX_CHARS } from "@acta/api/tasks/title";

import { COPY } from "@/components/copy";

// UI copy from docs/SPEC-tasks.md.
export const TASK_COPY = {
  navTasks: "Tasks",
  composerPlaceholder: "Add a task…",
  tabOpen: "Open",
  tabDone: "Done",
  tabTrash: "Trash",
  markDone: "Mark as done",
  reopen: "Mark as open",
  actions: "Task actions",
  toggleViews: "Show task views",
  dueDate: "Due date",
  clearDueDate: "Clear due date",
  overdue: (date: string) => `Overdue · ${date}`,
  dueToday: "Today",
  doneAt: (date: string) => `Done ${date}`,
  deletePermanentlyConfirm:
    "Delete this task permanently? This can't be undone.",
  errorEmpty: "A task can't be empty.",
  errorTooLong: `A task can be at most ${TASK_TITLE_MAX_CHARS} characters.`,
  conflictTitle: "This task changed on another device.",
  loadError: "Couldn't load your tasks.",
  emptyOpen: { title: "Nothing to do", text: "Add a task above." },
  emptyDone: { title: "No finished tasks yet" },
  emptyTrash: { title: COPY.trashEmpty, text: COPY.trashText("Tasks") },
} as const;
