import { describe, expect, it } from "vite-plus/test";

import { NOTE_MAX_CHARS, noteContent } from "./content";

function errorOf(value: string) {
  return noteContent.safeParse(value).error?.issues[0]?.message;
}

describe("noteContent", () => {
  it("rejects empty content", () => {
    expect(errorOf("")).toBe("empty");
  });

  it("rejects whitespace-only content", () => {
    expect(errorOf(" \n\t ")).toBe("empty");
  });

  it("accepts exactly the maximum number of code points", () => {
    expect(errorOf("a".repeat(NOTE_MAX_CHARS))).toBeUndefined();
  });

  it("rejects one code point over the maximum", () => {
    expect(errorOf("a".repeat(NOTE_MAX_CHARS + 1))).toBe("tooLong");
  });

  it("counts code points, not UTF-16 units", () => {
    expect(errorOf("😀".repeat(NOTE_MAX_CHARS))).toBeUndefined();
  });

  it("keeps content untrimmed", () => {
    expect(noteContent.parse("  hola  ")).toBe("  hola  ");
  });
});
