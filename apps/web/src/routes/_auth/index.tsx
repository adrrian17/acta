import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { COPY } from "@/components/notes/copy";
import { NoteEditor } from "@/components/notes/note-editor";
import { NoteList } from "@/components/notes/note-list";
import { invalidateNotes, trpc } from "@/utils/trpc";

const timelineSearchSchema = z.object({
  tag: z.string().optional(),
  untagged: z.literal(true).optional(),
});

export const Route = createFileRoute("/_auth/")({
  component: TimelineRoute,
  validateSearch: timelineSearchSchema,
});

function TimelineRoute() {
  const filter = Route.useSearch();
  // Bumped after each save to remount the composer empty.
  const [composerKey, setComposerKey] = useState(0);

  const create = useMutation(
    trpc.notes.create.mutationOptions({
      onSuccess: async () => {
        setComposerKey((key) => key + 1);
        await invalidateNotes();
      },
    })
  );

  return (
    <main className="grid content-start gap-3 px-3 pb-6 lg:px-4">
      <div className="bg-card focus-within:border-ring/60 rounded-xl border transition-colors">
        <NoteEditor
          key={composerKey}
          label={COPY.composerLabel}
          saving={create.isPending}
          onSave={(content) => {
            create.mutate({ content });
          }}
        />
      </div>
      <NoteList
        view="timeline"
        emptyText={COPY.emptyTimeline}
        tag={filter.tag}
        untagged={filter.untagged}
      />
    </main>
  );
}
