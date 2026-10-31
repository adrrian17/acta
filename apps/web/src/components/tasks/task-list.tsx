import type { Task } from "@acta/api/tasks/task";
import { Button } from "@acta/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@acta/ui/components/empty";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CircleCheck, ListTodo, Trash2 } from "lucide-react";

import Loader from "@/components/loader";
import { COPY } from "@/components/notes/copy";
import { trpc } from "@/utils/trpc";

import { TASK_COPY } from "./copy";
import { TaskRow } from "./task-row";

const EMPTY = {
  open: { icon: ListTodo, text: TASK_COPY.emptyOpen },
  done: { icon: CircleCheck, text: TASK_COPY.emptyDone },
  trashed: { icon: Trash2, text: TASK_COPY.emptyTrash },
};

export function TaskList({ view }: { view: Task["state"] }) {
  const query = useInfiniteQuery(
    trpc.tasks.list.infiniteQueryOptions(
      { view },
      { getNextPageParam: (page) => page.nextCursor }
    )
  );

  if (query.isPending) {
    return <Loader />;
  }

  if (query.isError && query.data === undefined) {
    return (
      <Empty className="my-12">
        <EmptyHeader>
          <EmptyTitle>{TASK_COPY.loadError}</EmptyTitle>
        </EmptyHeader>
        <Button
          variant="outline"
          onClick={() => {
            void query.refetch();
          }}
        >
          {TASK_COPY.retry}
        </Button>
      </Empty>
    );
  }

  const tasks = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (tasks.length === 0) {
    const { icon: EmptyIcon, text } = EMPTY[view];

    return (
      <Empty className="my-12">
        <EmptyHeader>
          <EmptyMedia variant="accent">
            <EmptyIcon aria-hidden className="size-5" />
          </EmptyMedia>
          <EmptyTitle>{COPY.emptyTitle}</EmptyTitle>
          <EmptyDescription>{text}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {tasks.map((task) => (
          <li key={task.id}>
            <TaskRow task={task} />
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => {
            void query.fetchNextPage();
          }}
        >
          {COPY.loadMore}
        </Button>
      )}
    </div>
  );
}
