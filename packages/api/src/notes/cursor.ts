import { z } from "zod";

/** Sort key of the last row in the Timeline or Archive. */
export const timelineCursor = z.object({
  pinned: z.boolean(),
  createdAt: z.int(),
  id: z.string(),
});
