export interface TagNode {
  name: string;
  path: string;
  count: number;
  children: TagNode[];
}

/** `a/b/c` → `a`, `a/b`, `a/b/c`. */
function withAncestors(tag: string): string[] {
  const segments = tag.split("/");

  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}

/**
 * The Tag tree for the given (Note, Tag) pairs. A node counts the distinct Notes
 * tagged with it or a descendant, and intermediate levels appear even if unused alone.
 */
export function buildTagTree(
  rows: readonly { noteId: string; tag: string }[]
): TagNode[] {
  const notesByPath = new Map<string, Set<string>>();

  for (const { noteId, tag } of rows) {
    for (const path of withAncestors(tag)) {
      const notes = notesByPath.get(path) ?? new Set<string>();
      notes.add(noteId);
      notesByPath.set(path, notes);
    }
  }

  const root: TagNode[] = [];
  const nodes = new Map<string, TagNode>();

  for (const path of [...notesByPath.keys()].toSorted()) {
    const segments = path.split("/");

    const node: TagNode = {
      name: segments.at(-1) ?? path,
      path,
      count: notesByPath.get(path)?.size ?? 0,
      children: [],
    };

    nodes.set(path, node);
    const parent = nodes.get(segments.slice(0, -1).join("/"));
    (parent?.children ?? root).push(node);
  }

  return root;
}
