import { Button } from "@acta/ui/components/button";
import { Card, CardContent } from "@acta/ui/components/card";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { COPY } from "@/components/notes/copy";
import { NoteEditor } from "@/components/notes/note-editor";
import { NoteList } from "@/components/notes/note-list";
import { TagPanel } from "@/components/notes/tag-panel";
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
  const [showTags, setShowTags] = useState(false);
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
    <main className="container mx-auto grid max-w-5xl content-start gap-4 px-4 py-4 lg:grid-cols-[14rem_1fr]">
      <h1 className="sr-only">{COPY.navTimeline}</h1>
      <div className="grid content-start gap-2">
        <Button
          variant="outline"
          className="lg:hidden"
          aria-expanded={showTags}
          aria-controls="tag-panel"
          onClick={() => {
            setShowTags((shown) => !shown);
          }}
        >
          {COPY.tagsToggle}
        </Button>
        <div id="tag-panel" className={showTags ? "block" : "hidden lg:block"}>
          <TagPanel active={filter} />
        </div>
      </div>
      <div className="grid content-start gap-4">
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
        <NoteList
          view="timeline"
          emptyText={COPY.emptyTimeline}
          tag={filter.tag}
          untagged={filter.untagged}
        />
      </div>
    </main>
  );
}
