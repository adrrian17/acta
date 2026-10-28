import { publicProcedure, router } from "../index";
import { notesRouter } from "./notes";
import { tagsRouter } from "./tags";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  notes: notesRouter,
  tags: tagsRouter,
});

export type AppRouter = typeof appRouter;
