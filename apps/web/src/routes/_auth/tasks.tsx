import { TASK_STATES } from "@acta/api/tasks/lifecycle";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { TASK_COPY } from "@/components/tasks/copy";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { invalidateTasks, trpc } from "@/utils/trpc";

const tasksSearchSchema = z.object({
  view: z.enum(TASK_STATES).optional(),
});

export const Route = createFileRoute("/_auth/tasks")({
  component: TasksRoute,
  validateSearch: tasksSearchSchema,
});

function TasksRoute() {
  const { view = "open" } = Route.useSearch();
  // Bumped after each create to remount the composer empty.
  const [composerKey, setComposerKey] = useState(0);

  const create = useMutation(
    trpc.tasks.create.mutationOptions({
      onSuccess: async () => {
        setComposerKey((key) => key + 1);
        await invalidateTasks();
      },
    })
  );

  return (
    <main className="grid content-start gap-3 px-3 pb-6 lg:px-4">
      {view === "open" && (
        <div className="bg-card focus-within:border-ring/60 rounded-xl border p-3 transition-colors">
          <TaskForm
            key={composerKey}
            label={TASK_COPY.composerPlaceholder}
            saving={create.isPending}
            onSave={(fields) => {
              create.mutate(fields);
            }}
          />
        </div>
      )}
      <TaskList view={view} />
    </main>
  );
}
