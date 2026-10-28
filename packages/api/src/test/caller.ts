import type { Session } from "@acta/auth";
import { GITHUB_PROVIDER_ID } from "@acta/auth/owner";
import { createDb } from "@acta/db";
import { account, user } from "@acta/db/schema/auth";

import { t } from "../index";
import { appRouter } from "../routers/index";
import { createTestD1 } from "./d1";

const OWNER_GITHUB_ID = "1234567";
const SEEDED_AT = new Date("2026-01-01T00:00:00Z");

/** A tRPC caller signed in as the Owner, over a fresh in-memory database. */
export async function createOwnerCaller() {
  const db = createDb({ DB: createTestD1() });

  const owner = {
    id: "owner",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: true,
    image: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  };

  await db.insert(user).values(owner);
  await db.insert(account).values({
    id: "owner-github",
    accountId: OWNER_GITHUB_ID,
    providerId: GITHUB_PROVIDER_ID,
    userId: owner.id,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  });

  const session: Session = {
    user: owner,
    session: {
      id: "session",
      token: "token",
      userId: owner.id,
      expiresAt: new Date("2100-01-01T00:00:00Z"),
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
      ipAddress: null,
      userAgent: null,
    },
  };

  const caller = t.createCallerFactory(appRouter)({
    db,
    session,
    ownerGithubId: OWNER_GITHUB_ID,
  });

  return { db, caller };
}
