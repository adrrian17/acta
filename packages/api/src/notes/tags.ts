/** A `#tag` token found in a Note's text. `start` is the `#`, `end` is exclusive. */
interface TagToken {
  start: number;
  end: number;
  raw: string;
  tag: string;
}

// Replaces excluded text without changing string indices; not whitespace, so it never starts a Tag.
const MASK = "\0";

const FENCE_OPEN = /^ {0,3}(?<fence>`{3,}|~{3,})/u;

// A run of N backticks up to the next run of exactly N, within one paragraph.
const CODE_SPAN =
  /(?<!`)(?<ticks>`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\k<ticks>(?!`)/gu;

const LINK_DESTINATION = /(?<=\])\([^)]*\)/gu;

// Masking from `://` is enough: a scheme cannot contain `#`.
const URL = /(?<=[\da-z]):\/\/\S+/giu;

const TAG_TOKEN =
  /(?<=^|[\s([])#(?<raw>[\p{L}\p{M}\p{N}_-]+(?:\/[\p{L}\p{M}\p{N}_-]+)*)/gu;

const TAG = /^[\p{L}\p{M}\p{N}_-]+(?:\/[\p{L}\p{M}\p{N}_-]+)*$/u;
const LETTER = /\p{L}/u;
const HORIZONTAL_SPACE = /[ \t]/u;

function mask(text: string, start: number, end: number): string {
  return text.slice(0, start) + MASK.repeat(end - start) + text.slice(end);
}

function maskFences(text: string): string {
  let masked = text;
  let fence: { char: string; length: number; start: number } | null = null;
  let offset = 0;

  for (const line of text.split("\n")) {
    const lineEnd = offset + line.length;

    if (fence) {
      const closing = new RegExp(
        `^ {0,3}${fence.char === "`" ? "`" : "~"}{${fence.length},}[ \\t]*$`,
        "u"
      );

      if (closing.test(line)) {
        masked = mask(masked, fence.start, lineEnd);
        fence = null;
      }
    } else {
      const opening = FENCE_OPEN.exec(line)?.groups?.fence;

      if (opening !== undefined) {
        fence = {
          char: opening.charAt(0),
          length: opening.length,
          start: offset,
        };
      }
    }

    offset = lineEnd + 1;
  }

  // An unclosed fence runs to the end of the Note.
  return fence ? mask(masked, fence.start, text.length) : masked;
}

function maskPattern(text: string, pattern: RegExp): string {
  let masked = text;

  for (const match of text.matchAll(pattern)) {
    masked = mask(masked, match.index, match.index + match[0].length);
  }

  return masked;
}

/** Text with every region that cannot hold a Tag masked out, index for index. */
function maskExcluded(text: string): string {
  const withoutCode = maskPattern(maskFences(text), CODE_SPAN);

  return maskPattern(maskPattern(withoutCode, LINK_DESTINATION), URL);
}

export function normalizeTag(raw: string): string {
  return raw.normalize("NFC").toLowerCase();
}

function scanTags(text: string): TagToken[] {
  const tokens: TagToken[] = [];

  for (const match of maskExcluded(text).matchAll(TAG_TOKEN)) {
    const [whole] = match;
    const raw = match.groups?.raw;

    if (raw !== undefined && LETTER.test(raw)) {
      tokens.push({
        start: match.index,
        end: match.index + whole.length,
        raw,
        tag: normalizeTag(raw),
      });
    }
  }

  return tokens;
}

/** A normalized Tag without its `#`: `ideas/libros`. */
export function isValidTag(tag: string): boolean {
  return TAG.test(tag) && LETTER.test(tag) && normalizeTag(tag) === tag;
}

/** True when `tag` is `ancestor` or one of its descendants. */
export function isTagOrDescendant(tag: string, ancestor: string): boolean {
  return tag === ancestor || tag.startsWith(`${ancestor}/`);
}

/** The distinct Tags in `text`, in order of first appearance. */
export function extractTags(text: string): string[] {
  return [...new Set(scanTags(text).map((token) => token.tag))];
}

/** Renaming onto itself or one of its own descendants is not allowed. */
export function canRenameTag(from: string, to: string): boolean {
  return isValidTag(from) && isValidTag(to) && !isTagOrDescendant(to, from);
}

/** Replaces the `from` prefix with `to` in every matching token, keeping the rest as typed. */
export function renameTag(text: string, from: string, to: string): string {
  const prefixSegments = from.split("/").length;
  let result = text;

  for (const token of scanTags(text).toReversed()) {
    if (isTagOrDescendant(token.tag, from)) {
      const rest = token.raw.split("/").slice(prefixSegments);
      const renamed = `#${[to, ...rest].join("/")}`;
      result = result.slice(0, token.start) + renamed + result.slice(token.end);
    }
  }

  return result;
}

function spaceRunStart(text: string, index: number): number {
  let start = index;

  while (start > 0 && HORIZONTAL_SPACE.test(text.charAt(start - 1))) {
    start -= 1;
  }

  return start;
}

function spaceRunEnd(text: string, index: number): number {
  let end = index;

  while (end < text.length && HORIZONTAL_SPACE.test(text.charAt(end))) {
    end += 1;
  }

  return end;
}

/** The range to cut so that removing a token leaves no whitespace it created. */
function removalRange(text: string, token: TagToken): [number, number] {
  const before = spaceRunStart(text, token.start);
  const after = spaceRunEnd(text, token.end);
  const atLineStart = before === 0 || text[before - 1] === "\n";
  const atLineEnd = after === text.length || text[after] === "\n";

  if (atLineStart && atLineEnd) {
    return [before, after];
  }

  if (atLineStart) {
    return [token.start, after];
  }

  if (atLineEnd) {
    return [before, token.end];
  }

  const spaceOnBothSides = before < token.start && after > token.end;

  return [token.start, spaceOnBothSides ? token.end + 1 : token.end];
}

/** Removes every token of `tag` and its descendants; surrounding words stay. */
export function deleteTag(text: string, tag: string): string {
  let result = text;

  // Right to left, so the positions of earlier tokens stay valid.
  for (const token of scanTags(text).toReversed()) {
    if (isTagOrDescendant(token.tag, tag)) {
      const [start, end] = removalRange(result, token);
      result = result.slice(0, start) + result.slice(end);
    }
  }

  return result;
}
