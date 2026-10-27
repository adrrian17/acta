import { GITHUB_PROVIDER_ID } from "@acta/auth/owner";
import type { Database } from "@acta/db";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const { router } = t;

export const publicProcedure = t.procedure;

async function findOwnerAccount(
  db: Database,
  userId: string,
  ownerGithubId: string
) {
  return await db.query.account.findFirst({
    columns: { id: true },
    where: { userId, providerId: GITHUB_PROVIDER_ID, accountId: ownerGithubId },
  });
}

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }

  // Checked on every call: a session from a previous Owner survives a change to OWNER_GITHUB_ID.
  const ownerAccount = await findOwnerAccount(
    ctx.db,
    ctx.session.user.id,
    ctx.ownerGithubId
  );

  if (!ownerAccount) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not the Owner" });
  }

  return await next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
