import { defineRelations } from "drizzle-orm";

import {
  account,
  authRelations,
  note,
  notesRelations,
  noteTag,
  session,
  user,
  verification,
} from "./schema";

export const relations = {
  ...defineRelations({ account, note, noteTag, session, user, verification }),
  ...authRelations,
  ...notesRelations,
};
