import { Card, CardContent } from "@acta/ui/components/card";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { COPY } from "@/components/notes/copy";
import { NoteEditor } from "@/components/notes/note-editor";
import { NoteList } from "@/components/notes/note-list";
import { invalidateNotes, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/")({
  component: TimelineRoute,
});

function TimelineRoute() {
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
    <main className="container mx-auto grid max-w-2xl content-start gap-4 px-4 py-4">
      <h1 className="sr-only">{COPY.navTimeline}</h1>
      <Card>
        <CardContent>
          <NoteEditor
            key={composerKey}
            label={COPY.composerLabel}
            saving={create.isPending}
            onSave={(content) => {
              create.mutate({ content });
            }}
          />
        </CardContent>
      </Card>
      <NoteList view="timeline" emptyText={COPY.emptyTimeline} />
    </main>
  );
}
