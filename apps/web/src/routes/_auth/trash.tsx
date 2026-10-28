import { createFileRoute } from "@tanstack/react-router";

import { COPY } from "@/components/notes/copy";
import { NoteList } from "@/components/notes/note-list";

export const Route = createFileRoute("/_auth/trash")({
  component: TrashRoute,
});

function TrashRoute() {
  return (
    <main className="container mx-auto grid max-w-2xl content-start gap-4 px-4 py-4">
      <h1 className="text-xl font-semibold max-lg:sr-only">{COPY.navTrash}</h1>
      <NoteList view="trashed" emptyText={COPY.emptyTrash} />
    </main>
  );
}
