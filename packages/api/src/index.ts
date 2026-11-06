import { isOwnerUser } from "@acta/auth/owner";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Context } from "./context";

// tRPC infers dev mode from process.env.NODE_ENV, which the Worker never receives,
// so it would send server stack traces to every client.
export const t = initTRPC.context<Context>().create({ isDev: false });

export const { router } = t;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }

  if (!(await isOwnerUser(ctx.db, ctx.session.user.id, ctx.ownerGithubId))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not the Owner" });
  }

  return await next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const byId = z.object({ id: z.string() });

/** A write guarded on the version the client last read. */
export const versioned = byId.extend({ version: z.int().positive() });
