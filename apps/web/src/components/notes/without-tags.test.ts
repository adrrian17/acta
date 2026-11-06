import { describe, expect, it } from "vite-plus/test";

import { withoutTags } from "./without-tags";

describe("withoutTags", () => {
  it("hides tag tokens and the gaps they leave", () => {
    expect(withoutTags("Hello #tag, world #a/b", ["tag", "a/b"])).toBe(
      "Hello, world"
    );
  });

  it("drops tag-only lines at the edges", () => {
    expect(withoutTags("Hola\n\n#hola", ["hola"])).toBe("Hola");
  });

  it("leaves Markdown away from tags untouched", () => {
    expect(withoutTags("    code\n`a != b`", [])).toBe("    code\n`a != b`");
  });

  it("is empty for a tag-only note", () => {
    expect(withoutTags("#solo", ["solo"])).toBe("");
  });
});
