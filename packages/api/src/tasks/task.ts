import type { task } from "@acta/db/schema/tasks";

import { purgeAt } from "../notes/lifecycle";
import type { TaskState } from "./lifecycle";

export interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  state: TaskState;
  version: number;
  createdAt: number;
  updatedAt: number;
  doneAt: number | null;
  trashedAt: number | null;
  purgeAt: number | null;
}

export function toTask(row: typeof task.$inferSelect): Task {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.dueDate,
    state: row.state,
    version: row.version,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    doneAt: row.doneAt?.getTime() ?? null,
    trashedAt: row.trashedAt?.getTime() ?? null,
    purgeAt: purgeAt(row.trashedAt)?.getTime() ?? null,
  };
}
