/** Inserts `text` at the selection, or at the start of the caret's line when `atLineStart`. */
export function insertText(
  value: string,
  selection: { start: number; end: number },
  text: string,
  atLineStart: boolean
) {
  if (atLineStart) {
    const lineStart = value.slice(0, selection.start).lastIndexOf("\n") + 1;

    return {
      value: value.slice(0, lineStart) + text + value.slice(lineStart),
      caret: selection.end + text.length,
    };
  }

  return {
    value: value.slice(0, selection.start) + text + value.slice(selection.end),
    caret: selection.start + text.length,
  };
}
