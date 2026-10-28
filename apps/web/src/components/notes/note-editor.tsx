import { Button } from "@acta/ui/components/button";
import { Label } from "@acta/ui/components/label";
import { Textarea } from "@acta/ui/components/textarea";
import { Eye, Hash, List, Save } from "lucide-react";
import { useId, useRef, useState } from "react";

import { COPY } from "./copy";
import { insertText } from "./insert-text";
import { NotePreview } from "./note-preview";

// Mirrors the server's content rules (NOTE_MAX_CHARS in @acta/api) so Save can explain itself.
const NOTE_MAX_CHARS = 100_000;

function contentError(content: string): "empty" | "tooLong" | null {
  if (content.trim() === "") {
    return "empty";
  }

  // oxlint-disable-next-line typescript/no-misused-spread -- the limit counts code points, which is exactly what spreading yields
  return [...content].length > NOTE_MAX_CHARS ? "tooLong" : null;
}

// An empty composer is the normal starting point; only explain "empty" once there was text.
function errorMessage(
  error: ReturnType<typeof contentError>,
  content: string,
  initialContent: string
): string | null {
  if (error === "tooLong") {
    return COPY.errorTooLong;
  }

  if (error === "empty" && (content !== "" || initialContent !== "")) {
    return COPY.errorEmpty;
  }

  return null;
}

interface NoteEditorProps {
  label: string;
  initialContent?: string;
  saving: boolean;
  onSave: (content: string) => void;
  onCancel?: () => void;
}

export function NoteEditor({
  label,
  initialContent = "",
  saving,
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [previewing, setPreviewing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaId = useId();
  const errorId = useId();
  const error = contentError(content);

  const message = errorMessage(error, content, initialContent);

  // Edits to an existing note keep Save and Cancel; the composer sends.
  const composing = onCancel === undefined;

  const insert = (text: string, atLineStart: boolean) => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const next = insertText(
      content,
      { start: textarea.selectionStart, end: textarea.selectionEnd },
      text,
      atLineStart
    );

    setContent(next.value);
    textarea.focus();
    // Re-rendering the controlled value moves the caret to the end, so restore it afterwards.
    requestAnimationFrame(() => {
      textarea.setSelectionRange(next.caret, next.caret);
    });
  };

  const save = () => {
    if (!saving && error === null) {
      onSave(content);
    }
  };

  return (
    <form
      className="grid"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="px-4 pt-3">
        {previewing ? (
          <div className="min-h-28 py-2">
            <NotePreview content={content} />
          </div>
        ) : (
          <>
            <Label htmlFor={textareaId} className="sr-only">
              {label}
            </Label>
            <Textarea
              id={textareaId}
              ref={textareaRef}
              value={content}
              placeholder={COPY.composerPlaceholder}
              aria-invalid={message !== null}
              aria-describedby={message === null ? undefined : errorId}
              variant="bare"
              className="min-h-28 resize-none"
              onChange={(event) => {
                setContent(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  save();
                }
              }}
            />
          </>
        )}
        {message !== null && (
          <p
            id={errorId}
            role="alert"
            className="text-destructive pb-1 text-sm"
          >
            {message}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <div className="text-muted-foreground flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={COPY.insertTag}
            disabled={previewing}
            onClick={() => {
              insert("#", false);
            }}
          >
            <Hash aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={COPY.insertList}
            disabled={previewing}
            onClick={() => {
              insert("- ", true);
            }}
          >
            <List aria-hidden />
          </Button>
          <span aria-hidden className="bg-border mx-1 h-4 w-px" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={COPY.preview}
            aria-pressed={previewing}
            onClick={() => {
              setPreviewing((shown) => !shown);
            }}
          >
            <Eye aria-hidden />
          </Button>
        </div>
        {composing ? (
          <Button
            type="submit"
            size="icon-sm"
            aria-label={COPY.send}
            title={COPY.send}
            disabled={saving || error !== null}
          >
            <Save aria-hidden />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {COPY.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={saving || error !== null}>
              {COPY.save}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
