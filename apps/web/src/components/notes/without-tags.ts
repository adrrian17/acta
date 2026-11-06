import { deleteTag } from "@acta/api/notes/tags";
import { parseMarkdown } from "@tanstack/markdown";
import type {
  BlockNode,
  InlineNode,
  MarkdownDocument,
  TableCellNode,
} from "@tanstack/markdown";

// shortcut: text nodes lose source context, so an escaped `\#ideas` hides too when #ideas is a Tag; map source offsets if that matters.
function hideInText(value: string, tags: readonly string[]): string {
  let text = value;

  for (const tag of tags) {
    text = deleteTag(text, tag);
  }

  return text;
}

function hideInInlines(
  nodes: InlineNode[],
  tags: readonly string[]
): InlineNode[] {
  return nodes.flatMap((node): InlineNode[] => {
    switch (node.type) {
      case "text": {
        const value = hideInText(node.value, tags);

        return value === "" ? [] : [{ ...node, value }];
      }

      case "strong":
      case "emphasis":
      case "strike": {
        const children = hideInInlines(node.children, tags);

        return children.length > 0 ? [{ ...node, children }] : [];
      }

      // A link keeps its text so it stays visible and clickable.
      case "link":
      case "inlineCode":
      case "inlineHtml":
      case "inlineComponent":
      case "image":
      case "break":
      case "footnoteReference": {
        return [node];
      }

      default: {
        return [node];
      }
    }
  });
}

function hideInCell(
  cell: TableCellNode,
  tags: readonly string[]
): TableCellNode {
  return { ...cell, children: hideInInlines(cell.children, tags) };
}

/** The block with Tags hidden, or nothing when it held only Tags. */
function hideInBlock(block: BlockNode, tags: readonly string[]): BlockNode[] {
  switch (block.type) {
    case "paragraph":
    case "heading": {
      const children = hideInInlines(block.children, tags);

      return children.length > 0 ? [{ ...block, children }] : [];
    }

    case "blockquote": {
      const children = block.children.flatMap((child) =>
        hideInBlock(child, tags)
      );

      return children.length > 0 ? [{ ...block, children }] : [];
    }

    case "list": {
      const items = block.items.flatMap((item) => {
        const children = item.children.flatMap((child) =>
          hideInBlock(child, tags)
        );

        // A task item keeps its checkbox; an item that was empty as typed stays.
        const emptied =
          children.length === 0 &&
          item.children.length > 0 &&
          item.checked === undefined;

        return emptied ? [] : [{ ...item, children }];
      });

      return items.length > 0 ? [{ ...block, items }] : [];
    }

    case "table": {
      return [
        {
          ...block,
          header: block.header.map((cell) => hideInCell(cell, tags)),
          rows: block.rows.map((row) =>
            row.map((cell) => hideInCell(cell, tags))
          ),
        },
      ];
    }

    case "code":
    case "html":
    case "thematicBreak":
    case "footnotes":
    case "callout":
    case "component": {
      return [block];
    }

    default: {
      return [block];
    }
  }
}

/**
 * A Note's parsed text for its card: Tags show as chips there, so their tokens are hidden.
 * Tags go after parsing, so hiding one never changes how the rest of the Markdown parses.
 */
export function withoutTags(
  content: string,
  tags: readonly string[]
): MarkdownDocument {
  const document = parseMarkdown(content);

  return {
    ...document,
    children: document.children.flatMap((block) => hideInBlock(block, tags)),
  };
}
