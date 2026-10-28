import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";

const MIGRATIONS_DIR = path.join(
  import.meta.dirname,
  "../../../db/src/migrations"
);

type BindValue = SQLInputValue | boolean | undefined;

// D1 binds booleans as 0/1 and undefined as NULL; node:sqlite accepts neither.
function toSqlite(value: BindValue): SQLInputValue {
  if (value === true) {
    return 1;
  }

  if (value === false) {
    return 0;
  }

  return value ?? null;
}

function createStatement(
  db: DatabaseSync,
  query: string,
  params: SQLInputValue[] = []
) {
  const execute = () => {
    const results = db.prepare(query).all(...params);

    const changes = Number(
      db.prepare("SELECT changes() AS changes").get()?.changes ?? 0
    );

    return { success: true, results, meta: { changes } };
  };

  return {
    execute,
    bind: (...values: BindValue[]) =>
      createStatement(db, query, values.map(toSqlite)),
    all: async () => await Promise.resolve(execute()),
    run: async () => await Promise.resolve(execute()),
    first: async () =>
      await Promise.resolve(db.prepare(query).get(...params) ?? null),
    raw: async () => {
      const statement = db.prepare(query);
      statement.setReturnArrays(true);

      return await Promise.resolve(statement.all(...params));
    },
  };
}

type Statement = ReturnType<typeof createStatement>;

/**
 * The slice of D1's API that `drizzle-orm/d1` calls, over an in-memory `node:sqlite`
 * database with every migration applied. Test-only.
 */
export function createTestD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");

  for (const dir of readdirSync(MIGRATIONS_DIR).toSorted()) {
    db.exec(
      readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf-8")
    );
  }

  const d1 = {
    prepare: (query: string) => createStatement(db, query),
    // D1 runs a batch as one transaction: any failure rolls back every statement.
    batch: async (statements: Statement[]) => {
      db.exec("BEGIN");

      try {
        const results = statements.map((statement) => statement.execute());
        db.exec("COMMIT");

        return await Promise.resolve(results);
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };

  // SAFETY: d1 implements every D1Database method drizzle-orm/d1 calls (prepare, bind, all, run, first, raw, batch).
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion -- a partial test double cannot satisfy the full D1Database type
  return d1 as unknown as D1Database;
}
