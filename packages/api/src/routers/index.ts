import { publicProcedure, router } from "../index";
import { notesRouter } from "./notes";
import { tagsRouter } from "./tags";
import { tasksRouter } from "./tasks";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  notes: notesRouter,
  tags: tagsRouter,
  tasks: tasksRouter,
});

export type AppRouter = typeof appRouter;
