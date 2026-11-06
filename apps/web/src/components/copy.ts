import { TRASH_RETENTION_DAYS } from "@acta/api/trash";

// UI copy shared by Notes and Tasks.
export const COPY = {
  appName: "acta",
  navLabel: "Views",
  openNav: "Open navigation",
  send: "Send",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  trash: "Move to trash",
  restore: "Restore",
  deletePermanently: "Delete permanently",
  purgeAt: (date: string) => `Deleted after ${date}`,
  trashEmpty: "Trash is empty",
  trashText: (items: string) =>
    `${items} here are deleted after ${TRASH_RETENTION_DAYS} days.`,
  loadMore: "Load more",
  retry: "Try again",
  conflictReload: "Reload",
  conflictOverwrite: "Overwrite",
} as const;
