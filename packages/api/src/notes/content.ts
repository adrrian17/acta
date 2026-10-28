import { z } from "zod";

export const NOTE_MAX_CHARS = 100_000;

export const noteContent = z
  .string()
  .refine((value) => value.trim() !== "", { error: "empty" })
  // oxlint-disable-next-line typescript/no-misused-spread -- the spec counts code points, which is exactly what spreading yields
  .refine((value) => [...value].length <= NOTE_MAX_CHARS, {
    error: "tooLong",
  });
