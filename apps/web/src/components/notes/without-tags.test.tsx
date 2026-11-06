import { extractTags } from "@acta/api/notes/tags";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { NotePreview } from "./note-preview";
import { withoutTags } from "./without-tags";

/** The HTML a Note card shows for `content`, without the preview's wrapper. */
function cardBody(content: string): string {
  const html = renderToStaticMarkup(
    <NotePreview content={withoutTags(content, extractTags(content))} />
  );

  return html.replaceAll(/^<div[^>]*>|<\/div>$/gu, "");
}

describe("withoutTags", () => {
  it("hides tag tokens and the gaps they leave", () => {
    expect(cardBody("Hello #tag, world #a/b")).toBe("<p>Hello, world</p>");
  });

  it("drops a paragraph that held only tags", () => {
    expect(cardBody("Hola\n\n#hola")).toBe("<p>Hola</p>");
  });

  it("is empty for a tag-only note", () => {
    expect(cardBody("#solo")).toBe("");
  });

  it("leaves code untouched", () => {
    expect(cardBody("`#ideas` #ideas")).toBe("<p><code>#ideas</code></p>");
  });

  it("keeps a tag that is a link's text", () => {
    expect(cardBody("read [#ideas](https://example.com) now")).toBe(
      '<p>read <a href="https://example.com">#ideas</a> now</p>'
    );
  });

  it("drops the brackets around a lone tag", () => {
    expect(cardBody("see (#ideas) and more")).toBe("<p>see and more</p>");
  });

  it("never turns the rest of a line into a reference definition", () => {
    expect(
      cardBody("#tag [Manual]: https://example.com\n\nKeep this text.")
    ).toBe("<p>[Manual]: https://example.com</p><p>Keep this text.</p>");
  });

  it("drops list items and lists that held only tags", () => {
    expect(cardBody("- #ideas\n- #work")).toBe("");
    expect(cardBody("- #ideas\n- milk")).toBe("<ul><li>milk</li></ul>");
  });

  it("drops a blockquote that held only tags", () => {
    expect(cardBody("> #ideas")).toBe("");
  });

  it("keeps the space between the nodes around a hidden tag", () => {
    expect(cardBody("x **a** #ideas **b**")).toBe(
      "<p>x <strong>a</strong> <strong>b</strong></p>"
    );
    expect(cardBody("x *a* #ideas, *b*")).toBe(
      "<p>x <em>a</em>, <em>b</em></p>"
    );
  });

  it("hides tags in footnotes", () => {
    expect(cardBody("[^1] x\n\n[^1]: note #ideas")).not.toContain("#ideas");
  });

  it("drops blocks whose lines held only tags", () => {
    expect(cardBody("#ideas\n#work")).toBe("");
    expect(cardBody("> #ideas\n> #work")).toBe("");
    expect(cardBody("- #ideas\n  #work")).toBe("");
  });

  it("keeps the space before a tag's neighbor and non-tag hashes", () => {
    expect(cardBody("hello #ideas**world**")).toBe(
      "<p>hello <strong>world</strong></p>"
    );
    expect(cardBody("hello **world**#ideas #ideas")).toBe(
      "<p>hello <strong>world</strong>#ideas</p>"
    );
  });

  it("hides a tag that starts the line after a hard break", () => {
    expect(cardBody("a\\\n#ideas b")).toBe("<p>a<br/>b</p>");
    expect(cardBody("**a\\\n#ideas b**")).toBe(
      "<p><strong>a<br/>b</strong></p>"
    );
  });

  it("hides tags in image text and drops tables that held only tags", () => {
    expect(cardBody("![#ideas](https://example.com/x.png)")).toContain(
      'alt=""'
    );
    expect(cardBody("| #ideas |\n| --- |\n| #work |")).toBe("");
  });
});
