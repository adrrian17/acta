import type { Context as ApiContext } from "@acta/api/context";
import type { Context as HonoContext } from "hono";

import { getDb, createAuth } from "./services";

export interface CreateContextOptions {
  context: HonoContext;
}

export async function createContext({
  context,
}: CreateContextOptions): Promise<ApiContext> {
  const db = getDb();

  const session = await createAuth(db).api.getSession({
    headers: context.req.raw.headers,
  });

  return {
    db,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
