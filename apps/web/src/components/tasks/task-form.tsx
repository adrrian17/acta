import { Button } from "@acta/ui/components/button";
import { Calendar } from "@acta/ui/components/calendar";
import { Label } from "@acta/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@acta/ui/components/popover";
import { Textarea } from "@acta/ui/components/textarea";
import { CalendarIcon, Save, X } from "lucide-react";
import { useId, useState } from "react";
import type { KeyboardEvent } from "react";

import { TASK_COPY } from "./copy";
import { formatDay, localDay } from "./due-date";

// Mirrors the server's title rule (TASK_TITLE_MAX_CHARS in @acta/api) so the form can explain itself.
const TASK_TITLE_MAX_CHARS = 500;

function titleError(title: string): "empty" | "tooLong" | null {
  if (title.trim() === "") {
    return "empty";
  }

  // oxlint-disable-next-line typescript/no-misused-spread -- the limit counts code points, which is exactly what spreading yields
  return [...title].length > TASK_TITLE_MAX_CHARS ? "tooLong" : null;
}

/** A YYYY-MM-DD day as a local-midnight Date, the shape Calendar works in. */
function parseDay(day: string): Date {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);

  return new Date(year, month - 1, date);
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const titleId = useId();
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
  }

  return (
    <form
      noValidate
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (!saving && error === null) {
          onSave({ title, dueDate });
        }
      }}
    >
      <Label htmlFor={titleId} className="sr-only">
        {label}
      </Label>
      <Textarea
        id={titleId}
        value={title}
        placeholder={TASK_COPY.composerPlaceholder}
        aria-invalid={message !== null && error !== null}
        aria-describedby={message === null ? undefined : errorId}
        autoFocus={onCancel !== undefined}
        variant="bare"
        rows={1}
        className="min-h-12 resize-none"
        onKeyDown={(event) => {
          cancelOnEscape(event);

          // A title is one line: Enter submits instead of adding a newline.
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        onChange={(event) => {
          // A pasted line break would fail the server's one-line rule, so fold it to a space.
          setTitle(event.target.value.replaceAll(/\r\n?|\n/gu, " "));
        }}
      />
      <div className="flex items-center gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={TASK_COPY.dueDate}
                onKeyDown={cancelOnEscape}
              />
            }
          >
            <CalendarIcon aria-hidden />
            {dueDate === null ? TASK_COPY.dueDate : formatDay(dueDate)}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto">
            <Calendar
              mode="single"
              selected={dueDate === null ? undefined : parseDay(dueDate)}
              defaultMonth={dueDate === null ? undefined : parseDay(dueDate)}
              onSelect={(date) => {
                setDueDate(
                  date === undefined ? null : localDay(date.getTime())
                );
                setPickerOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {dueDate !== null && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={TASK_COPY.clearDueDate}
            onClick={() => {
              setDueDate(null);
            }}
          >
            <X aria-hidden />
          </Button>
        )}
        {onCancel ? (
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {TASK_COPY.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={saving || error !== null}>
              {TASK_COPY.save}
            </Button>
          </div>
        ) : (
          <Button
            type="submit"
            size="icon-sm"
            aria-label={TASK_COPY.send}
            title={TASK_COPY.send}
            className="ml-auto"
            disabled={saving || error !== null}
          >
            <Save aria-hidden />
          </Button>
        )}
      </div>
      {message !== null && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
