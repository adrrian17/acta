import { z } from "zod";

/** The issue messages text validation reports; the web forms map them to copy. */
export const TEXT_ERRORS = { empty: "empty", tooLong: "tooLong" } as const;

/** Non-blank text of at most `maxChars` code points, kept untrimmed. */
export function boundedText(maxChars: number) {
  return (
    z
      .string()
      .refine((value) => value.trim() !== "", { error: TEXT_ERRORS.empty })
      // oxlint-disable-next-line typescript/no-misused-spread -- the spec counts code points, which is exactly what spreading yields
      .refine((value) => [...value].length <= maxChars, {
        error: TEXT_ERRORS.tooLong,
      })
  );
}
