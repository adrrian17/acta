import { z } from "zod";

import { boundedText } from "../text";

export const TASK_TITLE_MAX_CHARS = 500;

export const taskTitle = boundedText(TASK_TITLE_MAX_CHARS).refine(
  (value) => !/[\r\n]/u.test(value),
  { error: "multiline" }
);

/** A real calendar day as YYYY-MM-DD, with no time or time zone; `null` clears it. */
export const taskDueDate = z.iso.date({ error: "badDate" }).nullable();
