import { NOTE_MAX_CHARS } from "@acta/api/notes/content";

import { COPY } from "@/components/copy";

// UI copy from docs/SPEC-notes.md.
export const NOTE_COPY = {
  navTimeline: "Timeline",
  navArchive: "Archive",
  navTrash: "Trash",
  composerPlaceholder: "Write a note… Use #tags to organize it.",
  composerLabel: "New note",
  insertTag: "Insert tag",
  insertList: "Insert list item",
  noteActions: "Note actions",
  editorLabel: "Edit note",
  preview: "Preview",
  pin: "Pin",
  unpin: "Unpin",
  pinned: "Pinned",
  archive: "Archive",
  unarchive: "Unarchive",
  deletePermanentlyConfirm:
    "Delete this note permanently? This can't be undone.",
  errorEmpty: "A note can't be empty.",
  errorTooLong: `A note can be at most ${NOTE_MAX_CHARS.toLocaleString("en")} characters.`,
  conflictTitle: "This note changed on another device.",
  tagsTitle: "Tags",
  untagged: "Untagged",
  noTags: "No tags yet. Start organizing with #tag.",
  rename: "Rename",
  delete: "Delete",
  renameLabel: "New tag name",
  renameConfirm: (from: string, to: string, count: number) =>
    `Rename #${from} to #${to} in ${count} notes?`,
  deleteConfirm: (tag: string, count: number) =>
    `Remove #${tag} from ${count} notes? The rest of each note stays.`,
  tagsResult: (changed: number, skipped: number) =>
    `Updated ${changed} notes. ${skipped} skipped because they would end up empty or too long.`,
  loadError: "Couldn't load your notes.",
  emptyTimeline: { title: "No notes yet", text: "Write your first one above." },
  emptyFiltered: {
    title: "No matching notes",
    text: "Choose another tag or clear the filter.",
  },
  clearFilter: "Clear filter",
  emptyArchive: { title: "No archived notes" },
  emptyTrash: { title: COPY.trashEmpty, text: COPY.trashText("Notes") },
} as const;
