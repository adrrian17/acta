import { describe, expect, it } from "vite-plus/test";

import { insertText } from "./insert-text";

describe("insertText", () => {
  it("inserts a list marker before an empty first line", () => {
    expect(insertText("\nnext", { start: 0, end: 0 }, "- ", true)).toEqual({
      value: "- \nnext",
      caret: 2,
    });
  });
});
