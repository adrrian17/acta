import type { note, noteTag } from "@acta/db/schema/notes";

import { purgeAt } from "./lifecycle";
import type { NoteState } from "./lifecycle";

export interface Note {
  id: string;
  content: string;
  state: NoteState;
  pinned: boolean;
  version: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  trashedAt: number | null;
  purgeAt: number | null;
}

export type NoteRow = typeof note.$inferSelect & {
  tags: Pick<typeof noteTag.$inferSelect, "tag">[];
};

export function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    content: row.content,
    state: row.state,
    pinned: row.pinned,
    version: row.version,
    tags: row.tags.map(({ tag }) => tag).toSorted(),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    trashedAt: row.trashedAt?.getTime() ?? null,
    purgeAt: purgeAt(row.trashedAt)?.getTime() ?? null,
  };
}
