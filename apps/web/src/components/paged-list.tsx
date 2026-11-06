import { Button } from "@acta/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@acta/ui/components/empty";
import { cn } from "@acta/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { COPY } from "./copy";
import Loader from "./loader";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  text?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
}: EmptyStateProps) {
  return (
    <Empty className="my-12">
      <EmptyHeader>
        <EmptyMedia variant="accent">
          <Icon aria-hidden className="size-5" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {text !== undefined && <EmptyDescription>{text}</EmptyDescription>}
      </EmptyHeader>
      {children}
    </Empty>
  );
}

/** The slice of an infinite query over `{ items }` pages that a list renders. */
interface PagedQuery<T> {
  isPending: boolean;
  isError: boolean;
  data?: { pages: { items: T[] }[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  refetch: () => void;
  fetchNextPage: () => void;
}

interface PagedListProps<T> {
  query: PagedQuery<T>;
  loadError: string;
  empty: ReactElement;
  className: string;
  children: (item: T) => ReactNode;
}

export function PagedList<T extends { id: string }>({
  query,
  loadError,
  empty,
  className,
  children,
}: PagedListProps<T>) {
  if (query.isPending) {
    return <Loader />;
  }

  if (query.isError && query.data === undefined) {
    return (
      <Empty className="my-12">
        <EmptyHeader>
          <EmptyTitle>{loadError}</EmptyTitle>
        </EmptyHeader>
        <Button
          variant="outline"
          onClick={() => {
            query.refetch();
          }}
        >
          {COPY.retry}
        </Button>
      </Empty>
    );
  }

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (items.length === 0) {
    return empty;
  }

  return (
    <div className={cn("grid", className)}>
      <ul className={cn("grid", className)}>
        {items.map((item) => (
          <li key={item.id}>{children(item)}</li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => {
            query.fetchNextPage();
          }}
        >
          {COPY.loadMore}
        </Button>
      )}
    </div>
  );
}
