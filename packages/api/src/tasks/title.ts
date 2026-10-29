import { z } from "zod";

export const TASK_TITLE_MAX_CHARS = 500;

export const taskTitle = z
  .string()
  .refine((value) => value.trim() !== "", { error: "empty" })
  .refine((value) => !/[\r\n]/u.test(value), { error: "multiline" })
  // oxlint-disable-next-line typescript/no-misused-spread -- the spec counts code points, which is exactly what spreading yields
  .refine((value) => [...value].length <= TASK_TITLE_MAX_CHARS, {
    error: "tooLong",
  });

/** A real calendar day as YYYY-MM-DD, with no time or time zone; `null` clears it. */
export const taskDueDate = z.iso.date({ error: "badDate" }).nullable();
