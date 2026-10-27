import type { Session } from "@acta/auth";
import type { Database } from "@acta/db";

// oxlint-disable-next-line typescript/consistent-type-definitions -- tRPC's createContext needs Record<string, unknown>, which interfaces don't satisfy
export type Context = {
  session: Session | null;
  db: Database;
};
