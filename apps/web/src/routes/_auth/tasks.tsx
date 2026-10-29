import { TASK_STATES } from "@acta/api/tasks/lifecycle";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@acta/ui/components/tabs";
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

const TABS = [
  { view: "open", label: TASK_COPY.tabOpen },
  { view: "done", label: TASK_COPY.tabDone },
  { view: "trashed", label: TASK_COPY.tabTrash },
] as const;

export const Route = createFileRoute("/_auth/tasks")({
  component: TasksRoute,
  validateSearch: tasksSearchSchema,
});

function TasksRoute() {
  const { view = "open" } = Route.useSearch();
  const navigate = Route.useNavigate();
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
      <Tabs
        value={view}
        onValueChange={(next: (typeof TASK_STATES)[number]) => {
          void navigate({ search: next === "open" ? {} : { view: next } });
        }}
      >
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.view} value={tab.view}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsContent key={tab.view} value={tab.view}>
            <TaskList view={tab.view} />
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
