import type { Task } from "@acta/api/tasks/task";
import { Button } from "@acta/ui/components/button";
import { Checkbox } from "@acta/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@acta/ui/components/dropdown-menu";
import { cn } from "@acta/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { Ellipsis } from "lucide-react";
import { useState } from "react";

import { ConflictDialog } from "@/components/conflict-dialog";
import { COPY } from "@/components/copy";
import { DeleteDialog } from "@/components/delete-dialog";
import { formatDate } from "@/components/format-date";
import { useNow } from "@/components/use-now";
import { itemErrorHandler, useEditConflict } from "@/components/versioned-item";
import { invalidateTasks, queryClient, trpc } from "@/utils/trpc";

import { TASK_COPY } from "./copy";
import { dueStatus, formatDay, localDay } from "./due-date";
import { TaskForm } from "./task-form";
import type { TaskFields } from "./task-form";

const onError = itemErrorHandler(invalidateTasks);

function DueLabel({ dueDate }: { dueDate: string }) {
  const today = localDay(useNow());
  const status = dueStatus(dueDate, today);
  const date = formatDay(dueDate);

  return (
    <time
      dateTime={dueDate}
      className={cn(
        "text-muted-foreground shrink-0 text-xs",
        status === "overdue" && "text-destructive",
        status === "today" && "text-foreground font-medium"
      )}
    >
      {status === "overdue" && TASK_COPY.overdue(date)}
      {status === "today" && TASK_COPY.dueToday}
      {status === "upcoming" && date}
    </time>
  );
}

export function TaskRow({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const versioned = { id: task.id, version: task.version };

  const conflict = useEditConflict<TaskFields>(invalidateTasks);

  const update = useMutation(
    trpc.tasks.update.mutationOptions({
      onSuccess: async () => {
        conflict.clear();
        setEditing(false);
        await invalidateTasks();
      },
      onError: (error, { title, dueDate }) => {
        conflict.onUpdateError(error, { title, dueDate });
      },
    })
  );

  // The row slides out first and the list refetches when that ends, so it never just vanishes.
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await invalidateTasks();
    } else {
      setLeaving(true);
    }
  };

  const markDone = useMutation(
    trpc.tasks.markDone.mutationOptions({ onSuccess: leave, onError })
  );

  const reopen = useMutation(
    trpc.tasks.reopen.mutationOptions({ onSuccess: leave, onError })
  );

  const trash = useMutation(
    trpc.tasks.trash.mutationOptions({ onSuccess: leave, onError })
  );

  const restore = useMutation(
    trpc.tasks.restore.mutationOptions({ onSuccess: leave, onError })
  );

  const deletePermanently = useMutation(
    trpc.tasks.deletePermanently.mutationOptions({ onSuccess: leave, onError })
  );

  const busy = [
    update,
    markDone,
    reopen,
    trash,
    restore,
    deletePermanently,
  ].some((mutation) => mutation.isPending);

  if (editing) {
    return (
      <div className="bg-card focus-within:border-ring/60 rounded-xl border p-3 transition-colors">
        <TaskForm
          label={COPY.edit}
          initial={{ title: task.title, dueDate: task.dueDate }}
          saving={update.isPending}
          onSave={(fields) => {
            update.mutate({ ...versioned, ...fields });
          }}
          onCancel={() => {
            setEditing(false);
          }}
        />
        <ConflictDialog
          open={conflict.fields !== null}
          title={TASK_COPY.conflictTitle}
          pending={update.isPending}
          onClose={() => {
            conflict.clear();
          }}
          onReload={() => {
            setEditing(false);
            conflict.reload();
          }}
          onOverwrite={() => {
            void conflict.overwrite(
              async () => {
                const current = await queryClient.query(
                  trpc.tasks.get.queryOptions({ id: task.id }, { staleTime: 0 })
                );

                return current.version;
              },
              (version, fields) => {
                update.mutate({ id: task.id, version, ...fields });
              }
            );
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-rows-[1fr] transition-all duration-300 ease-out",
        leaving && "pointer-events-none grid-rows-[0fr] opacity-0"
      )}
      onTransitionEnd={(event) => {
        if (
          leaving &&
          event.target === event.currentTarget &&
          event.propertyName === "grid-template-rows"
        ) {
          void invalidateTasks();
        }
      }}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="bg-card flex min-h-12 items-start gap-3 rounded-xl border px-3 py-2">
          {task.state !== "trashed" && (
            <div className="flex h-8 items-center">
              <Checkbox
                checked={task.state === "done"}
                disabled={busy}
                aria-label={`${
                  task.state === "done" ? TASK_COPY.reopen : TASK_COPY.markDone
                }: ${task.title}`}
                onCheckedChange={(checked) => {
                  if (checked) {
                    markDone.mutate(versioned);
                  } else {
                    reopen.mutate(versioned);
                  }
                }}
              />
            </div>
          )}
          {/* Below sm the date wraps under the title so long titles keep their width. */}
          <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:gap-3">
            <p
              className={cn(
                "min-w-0 flex-1 py-1.5 text-sm break-words",
                task.state === "done" && "text-muted-foreground line-through"
              )}
            >
              {task.title}
            </p>
            <div className="flex shrink-0 items-center empty:hidden max-sm:pb-1.5 sm:h-8">
              {task.state === "open" && task.dueDate !== null && (
                <DueLabel dueDate={task.dueDate} />
              )}
              {task.state === "done" && task.doneAt !== null && (
                <span className="text-muted-foreground shrink-0 text-xs">
                  {TASK_COPY.doneAt(formatDate(task.doneAt))}
                </span>
              )}
              {task.purgeAt !== null && (
                <span className="text-muted-foreground shrink-0 text-xs">
                  {COPY.purgeAt(formatDate(task.purgeAt))}
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={TASK_COPY.actions}
                />
              }
            >
              <Ellipsis aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {task.state === "open" && (
                <DropdownMenuItem
                  disabled={busy}
                  onClick={() => {
                    setEditing(true);
                  }}
                >
                  {COPY.edit}
                </DropdownMenuItem>
              )}
              {task.state === "trashed" ? (
                <>
                  <DropdownMenuItem
                    disabled={busy}
                    onClick={() => {
                      restore.mutate(versioned);
                    }}
                  >
                    {COPY.restore}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      setConfirmingDelete(true);
                    }}
                  >
                    {COPY.deletePermanently}
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  disabled={busy}
                  onClick={() => {
                    trash.mutate(versioned);
                  }}
                >
                  {COPY.trash}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DeleteDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title={TASK_COPY.deletePermanentlyConfirm}
            pending={deletePermanently.isPending}
            onDelete={() => {
              deletePermanently.mutate({ id: task.id });
            }}
          />
        </div>
      </div>
    </div>
  );
}
