import { createFileRoute } from "@tanstack/react-router";

import { COPY } from "@/components/notes/copy";
import { NoteList } from "@/components/notes/note-list";

export const Route = createFileRoute("/_auth/trash")({
  component: TrashRoute,
});

function TrashRoute() {
  return (
    <main className="grid content-start gap-3 px-3 pb-6 lg:px-4">
      <NoteList view="trashed" emptyText={COPY.emptyTrash} />
    </main>
  );
}
