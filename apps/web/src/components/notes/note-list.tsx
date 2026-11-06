import type { Note } from "@acta/api/notes/note";
import { Button } from "@acta/ui/components/button";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Archive, Inbox, Trash2 } from "lucide-react";

import { EmptyState, PagedList } from "@/components/paged-list";
import { trpc } from "@/utils/trpc";

import { NOTE_COPY } from "./copy";
import { NoteCard } from "./note-card";

const EMPTY_ICONS = { timeline: Inbox, archived: Archive, trashed: Trash2 };

interface NoteListProps {
  view: Note["state"];
  empty: { title: string; text?: string };
  tag?: string;
  untagged?: true;
}

export function NoteList({ view, empty, tag, untagged }: NoteListProps) {
  const query = useInfiniteQuery(
    trpc.notes.list.infiniteQueryOptions(
      { view, tag, untagged },
      { getNextPageParam: (page) => page.nextCursor }
    )
  );

  return (
    <PagedList
      query={query}
      loadError={NOTE_COPY.loadError}
      className="gap-3"
      empty={
        <EmptyState
          icon={EMPTY_ICONS[view]}
          title={empty.title}
          text={empty.text}
        >
          {(tag !== undefined || untagged === true) && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/" />}
            >
              {NOTE_COPY.clearFilter}
            </Button>
          )}
        </EmptyState>
      }
    >
      {(note) => <NoteCard note={note} />}
    </PagedList>
  );
}
