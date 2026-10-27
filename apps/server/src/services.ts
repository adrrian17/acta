import { createAuth as createConfiguredAuth } from "@acta/auth";
import { createDb } from "@acta/db";
import type { Database } from "@acta/db";

import { ENV } from "./env.server";

export function getDb(): Database {
  return createDb(ENV);
}

export function createAuth(database?: Database) {
  return createConfiguredAuth(ENV, database ?? getDb());
}
