import type { Context as ApiContext } from "@acta/api/context";
import type { Context as HonoContext } from "hono";

import { ENV } from "./env.server";
import { getDb, createAuth } from "./services";

export async function createContext(context: HonoContext): Promise<ApiContext> {
  const db = getDb();

  const session = await createAuth(db).api.getSession({
    headers: context.req.raw.headers,
  });

  return {
    db,
    session,
    ownerGithubId: ENV.OWNER_GITHUB_ID,
  };
}
