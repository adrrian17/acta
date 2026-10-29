import { Button } from "@acta/ui/components/button";
import { Input } from "@acta/ui/components/input";
import { Label } from "@acta/ui/components/label";
import { X } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { TASK_COPY } from "./copy";

// Mirrors the server's title rule (TASK_TITLE_MAX_CHARS in @acta/api) so the form can explain itself.
const TASK_TITLE_MAX_CHARS = 500;

function titleError(title: string): "empty" | "tooLong" | null {
  if (title.trim() === "") {
    return "empty";
  }

  // oxlint-disable-next-line typescript/no-misused-spread -- the limit counts code points, which is exactly what spreading yields
  return [...title].length > TASK_TITLE_MAX_CHARS ? "tooLong" : null;
}

export interface TaskFields {
  title: string;
  dueDate: string | null;
}

const NO_FIELDS: TaskFields = { title: "", dueDate: null };

interface TaskFormProps {
  label: string;
  initial?: TaskFields;
  saving: boolean;
  onSave: (fields: TaskFields) => void;
  /** Given when editing: shows Save and Cancel, and Escape cancels. */
  onCancel?: () => void;
}

export function TaskForm({
  label,
  initial = NO_FIELDS,
  saving,
  onSave,
  onCancel,
}: TaskFormProps) {
  const [title, setTitle] = useState(initial.title);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  // A half-typed date reads as "" and fires no change event, so check it on submit instead of dropping it.
  const [badDate, setBadDate] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const dateId = useId();
  const errorId = useId();
  const error = titleError(title);

  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      onCancel();
    }
  };

  // An empty title is the normal starting point; only explain "empty" once there was text.
  let message: string | null = null;

  if (error === "tooLong") {
    message = TASK_COPY.errorTooLong;
  } else if (error === "empty" && (title !== "" || initial.title !== "")) {
    message = TASK_COPY.errorEmpty;
  } else if (badDate) {
    message = TASK_COPY.errorBadDate;
  }

  return (
    <form
      noValidate
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const dateIsBad = dateRef.current?.validity.badInput === true;
        setBadDate(dateIsBad);

        if (!saving && error === null && !dateIsBad) {
          onSave({ title, dueDate });
        }
      }}
    >
      <div className="flex items-center gap-2">
        <Label htmlFor={titleId} className="sr-only">
          {label}
        </Label>
        <Input
          id={titleId}
          value={title}
          placeholder={TASK_COPY.composerPlaceholder}
          aria-invalid={message !== null && error !== null}
          aria-describedby={message === null ? undefined : errorId}
          autoFocus={onCancel !== undefined}
          className="flex-1"
          onKeyDown={cancelOnEscape}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <Label htmlFor={dateId} className="sr-only">
          {TASK_COPY.dueDate}
        </Label>
        <Input
          id={dateId}
          ref={dateRef}
          type="date"
          value={dueDate ?? ""}
          aria-invalid={badDate}
          className="w-auto"
          onKeyDown={cancelOnEscape}
          onChange={(event) => {
            setBadDate(event.target.validity.badInput);
            setDueDate(event.target.value === "" ? null : event.target.value);
          }}
        />
        {dueDate !== null && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={TASK_COPY.clearDueDate}
            onClick={() => {
              setDueDate(null);
              setBadDate(false);
            }}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
      {message !== null && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {message}
        </p>
      )}
      {onCancel ? (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {TASK_COPY.cancel}
          </Button>
          <Button type="submit" size="sm" disabled={saving || error !== null}>
            {TASK_COPY.save}
          </Button>
        </div>
      ) : (
        // Enter submits; a form needs a submit control for that to work in every browser.
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      )}
    </form>
  );
}
