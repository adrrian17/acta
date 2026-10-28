import { Button } from "@acta/ui/components/button";
import { Label } from "@acta/ui/components/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@acta/ui/components/tabs";
import { Textarea } from "@acta/ui/components/textarea";
import { Hash, List, SendHorizontal } from "lucide-react";
import { useId, useRef, useState } from "react";

import { COPY } from "./copy";
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

/** Inserts `text` at the selection, or at the start of the caret's line when `atLineStart`. */
function insertText(
  value: string,
  selection: { start: number; end: number },
  text: string,
  atLineStart: boolean
) {
  if (atLineStart) {
    const lineStart = value.lastIndexOf("\n", selection.start - 1) + 1;

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
  const [tab, setTab] = useState("write");
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
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="write">{COPY.write}</TabsTrigger>
          <TabsTrigger value="preview">{COPY.preview}</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
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
            className="min-h-24 resize-none"
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
        </TabsContent>
        <TabsContent value="preview">
          <div className="min-h-24 px-1 py-2">
            <NotePreview content={content} />
          </div>
        </TabsContent>
      </Tabs>
      {message !== null && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {message}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={COPY.insertTag}
            disabled={tab !== "write"}
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
            disabled={tab !== "write"}
            onClick={() => {
              insert("- ", true);
            }}
          >
            <List aria-hidden />
          </Button>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {COPY.cancel}
            </Button>
          )}
          <Button type="submit" size="pill" disabled={saving || error !== null}>
            {composing && (
              <SendHorizontal aria-hidden data-icon="inline-start" />
            )}
            {composing ? COPY.send : COPY.save}
          </Button>
        </div>
      </div>
    </form>
  );
}
