import { taskTitle } from "@acta/api/tasks/title";
import { Button } from "@acta/ui/components/button";
import { Calendar } from "@acta/ui/components/calendar";
import { Label } from "@acta/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@acta/ui/components/popover";
import { Textarea } from "@acta/ui/components/textarea";
import { ArrowUp, CalendarIcon, Loader2, X } from "lucide-react";
import { useId, useState } from "react";
import type { KeyboardEvent } from "react";

import { COPY } from "@/components/copy";

import { TASK_COPY } from "./copy";
import { formatDay, localDay, parseDay } from "./due-date";

/** The server's own title rule, so the form can explain a Save it would reject. */
function titleError(title: string): string | null {
  return taskTitle.safeParse(title).error?.issues[0]?.message ?? null;
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
            {dueDate === null ? (
              // An unset date is a hint, so it stays as quiet as the placeholder.
              <span className="text-muted-foreground flex items-center gap-1.5 font-normal">
                <CalendarIcon aria-hidden />
                {TASK_COPY.dueDate}
              </span>
            ) : (
              <>
                <CalendarIcon aria-hidden />
                {formatDay(dueDate)}
              </>
            )}
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
              {COPY.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={saving || error !== null}>
              {saving && (
                <Loader2 aria-hidden className="motion-safe:animate-spin" />
              )}
              {COPY.save}
            </Button>
          </div>
        ) : (
          <Button
            type="submit"
            size="icon-sm"
            aria-label={COPY.send}
            title={COPY.send}
            className="ml-auto"
            disabled={saving || error !== null}
          >
            {saving ? (
              <Loader2 aria-hidden className="motion-safe:animate-spin" />
            ) : (
              <ArrowUp aria-hidden />
            )}
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
