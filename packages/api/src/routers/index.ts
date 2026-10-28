import { protectedProcedure, publicProcedure, router } from "../index";
import { notesRouter } from "./notes";
import { tagsRouter } from "./tags";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  // Removed with /dashboard in the Timeline UI task.
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
  notes: notesRouter,
  tags: tagsRouter,
});

export type AppRouter = typeof appRouter;
