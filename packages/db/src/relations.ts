import { defineRelations } from "drizzle-orm";

import {
  account,
  authRelations,
  note,
  notesRelations,
  noteTag,
  session,
  task,
  user,
  verification,
} from "./schema";

export const relations = {
  ...defineRelations({
    account,
    note,
    noteTag,
    session,
    task,
    user,
    verification,
  }),
  ...authRelations,
  ...notesRelations,
};
