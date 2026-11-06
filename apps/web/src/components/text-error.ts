import { TEXT_ERRORS } from "@acta/api/text";
import type { z } from "zod";

interface TextError {
  invalid: boolean;
  message: string | null;
}

/**
 * Whether the server would reject `value`, and what to tell the Owner. An empty field is
 * the normal starting point, so "empty" is only explained once there was text.
 */
export function textError(
  schema: z.ZodType,
  value: string,
  initial: string,
  copy: { empty: string; tooLong: string }
): TextError {
  const code = schema.safeParse(value).error?.issues[0]?.message;

  if (code === TEXT_ERRORS.tooLong) {
    return { invalid: true, message: copy.tooLong };
  }

  if (code === TEXT_ERRORS.empty) {
    const hadText = value !== "" || initial !== "";

    return { invalid: true, message: hadText ? copy.empty : null };
  }

  return { invalid: code !== undefined, message: null };
}
