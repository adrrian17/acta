import type { Task } from "@acta/api/tasks/task";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@acta/ui/components/alert-dialog";
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
import { toast } from "sonner";

import { ConflictDialog } from "@/components/notes/conflict-dialog";
import { useNow } from "@/components/notes/use-now";
import { invalidateTasks, queryClient, trpc } from "@/utils/trpc";

import { TASK_COPY } from "./copy";
import { dueStatus, formatDay, localDay } from "./due-date";
import { TaskForm } from "./task-form";
import type { TaskFields } from "./task-form";

const onSuccess = invalidateTasks;

// The row is out of date: the Task changed, is gone, or is no longer in that state.
const STALE_TASK_CODES = new Set([
  "CONFLICT",
  "NOT_FOUND",
  "PRECONDITION_FAILED",
]);

function onError(error: { message: string; data?: { code?: string } | null }) {
  const code = error.data?.code;

  if (code !== undefined && STALE_TASK_CODES.has(code)) {
    void invalidateTasks();
  }

  toast.error(error.message);
}

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

  // The local edit that lost a version check, kept until Reload or Overwrite.
  const [conflict, setConflict] = useState<TaskFields | null>(null);

  const update = useMutation(
    trpc.tasks.update.mutationOptions({
      onSuccess: async () => {
        setConflict(null);
        setEditing(false);
        await invalidateTasks();
      },
      onError: (error, { title, dueDate }) => {
        if (error.data?.code === "CONFLICT") {
          setConflict({ title, dueDate });

          return;
        }

        setConflict(null);
        onError(error);
      },
    })
  );

  const reload = () => {
    setConflict(null);
    setEditing(false);
    void invalidateTasks();
  };

  const overwrite = async (fields: TaskFields) => {
    try {
      const current = await queryClient.query(
        trpc.tasks.get.queryOptions({ id: task.id }, { staleTime: 0 })
      );

      update.mutate({ id: task.id, version: current.version, ...fields });
    } catch {
      // The Task is gone; the query cache already reported it. Drop the stale row.
      setConflict(null);
      void invalidateTasks();
    }
  };

  const markDone = useMutation(
    trpc.tasks.markDone.mutationOptions({ onSuccess, onError })
  );

  const reopen = useMutation(
    trpc.tasks.reopen.mutationOptions({ onSuccess, onError })
  );

  const trash = useMutation(
    trpc.tasks.trash.mutationOptions({ onSuccess, onError })
  );

  const restore = useMutation(
    trpc.tasks.restore.mutationOptions({ onSuccess, onError })
  );

  const deletePermanently = useMutation(
    trpc.tasks.deletePermanently.mutationOptions({ onSuccess, onError })
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
      <div className="bg-card rounded-xl border p-3">
        <TaskForm
          label={TASK_COPY.edit}
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
          open={conflict !== null}
          title={TASK_COPY.conflictTitle}
          pending={update.isPending}
          onClose={() => {
            setConflict(null);
          }}
          onReload={reload}
          onOverwrite={() => {
            if (conflict !== null) {
              void overwrite(conflict);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-card flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2">
      {task.state !== "trashed" && (
        <Checkbox
          checked={task.state === "done"}
          disabled={busy}
          aria-label={
            task.state === "done" ? TASK_COPY.reopen : TASK_COPY.markDone
          }
          onCheckedChange={(checked) => {
            if (checked) {
              markDone.mutate(versioned);
            } else {
              reopen.mutate(versioned);
            }
          }}
        />
      )}
      <p
        className={cn(
          "min-w-0 flex-1 text-sm break-words",
          task.state === "done" && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </p>
      {task.state === "open" && task.dueDate !== null && (
        <DueLabel dueDate={task.dueDate} />
      )}
      {task.state === "done" && task.doneAt !== null && (
        <span className="text-muted-foreground shrink-0 text-xs">
          {TASK_COPY.doneAt(new Date(task.doneAt).toLocaleDateString())}
        </span>
      )}
      {task.purgeAt !== null && (
        <span className="text-muted-foreground shrink-0 text-xs">
          {TASK_COPY.purgeAt(new Date(task.purgeAt).toLocaleDateString())}
        </span>
      )}
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
              {TASK_COPY.edit}
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
                {TASK_COPY.restore}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setConfirmingDelete(true);
                }}
              >
                {TASK_COPY.deletePermanently}
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              disabled={busy}
              onClick={() => {
                trash.mutate(versioned);
              }}
            >
              {TASK_COPY.trash}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {TASK_COPY.deletePermanentlyConfirm}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{TASK_COPY.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePermanently.isPending}
              onClick={() => {
                deletePermanently.mutate({ id: task.id });
              }}
            >
              {TASK_COPY.deletePermanently}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
