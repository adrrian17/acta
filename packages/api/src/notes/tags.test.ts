import { describe, expect, it } from "vite-plus/test";

import {
  canRenameTag,
  deleteTag,
  extractTags,
  isValidTag,
  renameTag,
} from "./tags";

describe("extractTags", () => {
  it("lowercases Tags and keeps hierarchy (AC 7)", () => {
    expect(extractTags("Hoy #Ideas y #ideas/libros")).toEqual([
      "ideas",
      "ideas/libros",
    ]);
  });

  it("ignores inline code, fenced code and URL fragments (AC 8)", () => {
    expect(extractTags("`#notatag`")).toEqual([]);
    expect(extractTags("```\n#tag\n```")).toEqual([]);
    expect(extractTags("https://x.com/#frag")).toEqual([]);
  });

  it("ignores ~~~ fences and longer backtick fences", () => {
    expect(extractTags("~~~\n#a\n~~~\n#b")).toEqual(["b"]);
    expect(extractTags("````\n```\n#a\n````\n#b")).toEqual(["b"]);
  });

  it("treats an unclosed fence as code to the end of the Note", () => {
    expect(extractTags("#before\n```\n#after")).toEqual(["before"]);
  });

  it("ignores double-backtick code spans that contain a backtick", () => {
    expect(extractTags("``a ` #x`` #y")).toEqual(["y"]);
  });

  it("ignores link destinations but not link text", () => {
    expect(extractTags("[#tag](https://x.com/#frag) [a](#anchor)")).toEqual([
      "tag",
    ]);
  });

  it("starts only after whitespace, ( or [, and never when escaped", () => {
    expect(extractTags("(#a) [#b] x#c \\#d")).toEqual(["a", "b"]);
  });

  it("never reads a heading as a Tag", () => {
    expect(extractTags("# Title\n## Sub")).toEqual([]);
  });

  it("accepts accented letters", () => {
    expect(extractTags("#canción #Über")).toEqual(["canción", "über"]);
  });

  it("normalizes NFD input to NFC", () => {
    expect(extractTags("#canción")).toEqual(["canción"]);
  });

  it("requires at least one letter", () => {
    expect(extractTags("#1 priority, #2026, #2026-q1")).toEqual(["2026-q1"]);
  });

  it("drops a trailing / and stops at //", () => {
    expect(extractTags("#a/ #b//c")).toEqual(["a", "b"]);
  });

  it("returns each Tag once", () => {
    expect(extractTags("#a #A #a")).toEqual(["a"]);
  });
});

describe("isValidTag", () => {
  it("accepts normalized Tags", () => {
    expect(isValidTag("ideas/libros")).toBe(true);
    expect(isValidTag("a-b_c")).toBe(true);
  });

  it("rejects malformed or unnormalized Tags", () => {
    expect(isValidTag("")).toBe(false);
    expect(isValidTag("Ideas")).toBe(false);
    expect(isValidTag("2026")).toBe(false);
    expect(isValidTag("a//b")).toBe(false);
    expect(isValidTag("a/")).toBe(false);
    expect(isValidTag("#a")).toBe(false);
  });
});

describe("renameTag", () => {
  it("rewrites the Tag and its descendants, keeping the rest (AC 10)", () => {
    expect(renameTag("Hoy #Ideas y #ideas/Libros", "ideas", "thoughts")).toBe(
      "Hoy #thoughts y #thoughts/Libros"
    );
  });

  it("leaves similar Tags and code alone", () => {
    expect(renameTag("#ideasx `#ideas`", "ideas", "thoughts")).toBe(
      "#ideasx `#ideas`"
    );
  });

  it("merges onto an existing Tag", () => {
    expect(extractTags(renameTag("#a #b", "a", "b"))).toEqual(["b"]);
  });

  it("renames a nested Tag", () => {
    expect(renameTag("#work/Old/x", "work/old", "work/new")).toBe(
      "#work/new/x"
    );
  });
});

describe("canRenameTag", () => {
  it("rejects renaming a Tag to itself or a descendant", () => {
    expect(canRenameTag("ideas", "ideas")).toBe(false);
    expect(canRenameTag("ideas", "ideas/libros")).toBe(false);
  });

  it("accepts a sibling or an ancestor", () => {
    expect(canRenameTag("ideas", "thoughts")).toBe(true);
    expect(canRenameTag("a/b", "a")).toBe(true);
    expect(canRenameTag("ideas", "ideasx")).toBe(true);
  });

  it("rejects invalid Tags", () => {
    expect(canRenameTag("ideas", "Thoughts")).toBe(false);
  });
});

describe("deleteTag", () => {
  it("collapses the double space it leaves (AC 11)", () => {
    expect(deleteTag("uno #ideas dos", "ideas")).toBe("uno dos");
  });

  it("removes descendants too", () => {
    expect(deleteTag("a #ideas/libros b", "ideas")).toBe("a b");
  });

  it("trims only the whitespace it created at line edges", () => {
    expect(deleteTag("#ideas uno\ndos #ideas", "ideas")).toBe("uno\ndos");
    expect(deleteTag("  #ideas uno", "ideas")).toBe("  uno");
  });

  it("never removes newlines", () => {
    expect(deleteTag("uno\n#ideas\ndos", "ideas")).toBe("uno\n\ndos");
  });

  it("removes adjacent tokens cleanly", () => {
    expect(deleteTag("uno #a #a/b dos", "a")).toBe("uno dos");
  });

  it("keeps punctuation next to the Tag", () => {
    expect(deleteTag("uno #ideas, dos", "ideas")).toBe("uno , dos");
  });

  it("leaves code and other Tags untouched", () => {
    expect(deleteTag("`#ideas` #ideasx", "ideas")).toBe("`#ideas` #ideasx");
  });
});
