import { boundedText } from "@acta/api/text";
import { describe, expect, it } from "vite-plus/test";

import { textError } from "./text-error";

const schema = boundedText(3);
const copy = { empty: "empty!", tooLong: "too long!" };

describe("textError", () => {
  it("accepts valid text", () => {
    expect(textError(schema, "abc", "", copy)).toEqual({
      invalid: false,
      message: null,
    });
  });

  it("explains text over the limit", () => {
    expect(textError(schema, "abcd", "", copy)).toEqual({
      invalid: true,
      message: "too long!",
    });
  });

  it("blocks an untouched empty field without explaining it", () => {
    expect(textError(schema, "", "", copy)).toEqual({
      invalid: true,
      message: null,
    });
  });

  it("explains emptiness once there was text", () => {
    expect(textError(schema, " ", "", copy).message).toBe("empty!");
    expect(textError(schema, "", "abc", copy).message).toBe("empty!");
  });
});
