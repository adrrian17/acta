import { defineRelations } from "drizzle-orm";

import { account, authRelations, session, user, verification } from "./schema";

export const relations = {
  ...defineRelations({ account, session, user, verification }),
  ...authRelations,
};
