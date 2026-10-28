import type { Note } from "@acta/api/notes/note";
import { Button } from "@acta/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@acta/ui/components/empty";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Archive, Inbox, Trash2 } from "lucide-react";

import Loader from "@/components/loader";
import { trpc } from "@/utils/trpc";

import { COPY } from "./copy";
import { NoteCard } from "./note-card";

const EMPTY_ICONS = { timeline: Inbox, archived: Archive, trashed: Trash2 };

interface NoteListProps {
  view: Note["state"];
  emptyText: string;
  tag?: string;
  untagged?: true;
}

export function NoteList({ view, emptyText, tag, untagged }: NoteListProps) {
  const query = useInfiniteQuery(
    trpc.notes.list.infiniteQueryOptions(
      { view, tag, untagged },
      { getNextPageParam: (page) => page.nextCursor }
    )
  );

  if (query.isPending) {
    return <Loader />;
  }

  const notes = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (notes.length === 0) {
    const EmptyIcon = EMPTY_ICONS[view];

    return (
      <Empty className="my-12">
        <EmptyHeader>
          <EmptyMedia variant="accent">
            <EmptyIcon aria-hidden className="size-5" />
          </EmptyMedia>
          <EmptyTitle>{COPY.emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyText}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        {notes.map((note) => (
          <li key={note.id}>
            <NoteCard note={note} />
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
