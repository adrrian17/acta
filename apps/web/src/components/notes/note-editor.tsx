import { Button } from "@acta/ui/components/button";
import { Label } from "@acta/ui/components/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@acta/ui/components/tabs";
import { Textarea } from "@acta/ui/components/textarea";
import { useId, useState } from "react";

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
  const textareaId = useId();
  const errorId = useId();
  const error = contentError(content);

  const message = errorMessage(error, content, initialContent);

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
      <Tabs defaultValue="write">
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
            value={content}
            placeholder={COPY.composerPlaceholder}
            aria-invalid={message !== null}
            aria-describedby={message === null ? undefined : errorId}
            className="min-h-24"
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
          <div className="min-h-24 rounded-md border p-3">
            <NotePreview content={content} />
          </div>
        </TabsContent>
      </Tabs>
      {message !== null && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {COPY.cancel}
          </Button>
        )}
        <Button type="submit" disabled={saving || error !== null}>
          {COPY.save}
        </Button>
      </div>
    </form>
  );
}
