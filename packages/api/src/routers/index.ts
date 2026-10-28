import { protectedProcedure, publicProcedure, router } from "../index";
import { notesRouter } from "./notes";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  // Removed with /dashboard in the Timeline UI task.
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
  notes: notesRouter,
});

export type AppRouter = typeof appRouter;
