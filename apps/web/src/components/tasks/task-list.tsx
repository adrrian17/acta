import type { Task } from "@acta/api/tasks/task";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CircleCheck, ListTodo, Trash2 } from "lucide-react";

import { EmptyState, PagedList } from "@/components/paged-list";
import { trpc } from "@/utils/trpc";

import { TASK_COPY } from "./copy";
import { TaskRow } from "./task-row";

const EMPTY = {
  open: { icon: ListTodo, copy: TASK_COPY.emptyOpen },
  done: { icon: CircleCheck, copy: TASK_COPY.emptyDone },
  trashed: { icon: Trash2, copy: TASK_COPY.emptyTrash },
};

export function TaskList({ view }: { view: Task["state"] }) {
  const query = useInfiniteQuery(
    trpc.tasks.list.infiniteQueryOptions(
      { view },
      { getNextPageParam: (page) => page.nextCursor }
    )
  );

  const { icon, copy } = EMPTY[view];

  return (
    <PagedList
      query={query}
      loadError={TASK_COPY.loadError}
      className="gap-2"
      empty={
        <EmptyState
          icon={icon}
          title={copy.title}
          text={"text" in copy ? copy.text : undefined}
        />
      }
    >
      {(task) => <TaskRow task={task} />}
    </PagedList>
  );
}
