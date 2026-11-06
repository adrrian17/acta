import { deleteTag } from "@acta/api/notes/tags";

/** A Note's text for its card: Tags show as chips there, so their tokens are hidden. */
export function withoutTags(content: string, tags: readonly string[]): string {
  let text = content;

  for (const tag of tags) {
    text = deleteTag(text, tag);
  }

  // Drop only the blank lines a removed tag line leaves at the edges; indentation is Markdown.
  const lines = text.split("\n");

  while (lines.length > 0 && lines[0]?.trim() === "") {
    lines.shift();
  }

  while (lines.length > 0 && lines.at(-1)?.trim() === "") {
    lines.pop();
  }

  return lines.join("\n");
}
