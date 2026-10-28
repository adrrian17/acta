import { createFileRoute } from "@tanstack/react-router";

import { COPY } from "@/components/notes/copy";
import { NoteList } from "@/components/notes/note-list";

export const Route = createFileRoute("/_auth/archive")({
  component: ArchiveRoute,
});

function ArchiveRoute() {
  return (
    <main className="container mx-auto grid max-w-2xl content-start gap-4 px-4 py-4">
      <h1 className="text-xl font-semibold">{COPY.navArchive}</h1>
      <NoteList view="archived" emptyText={COPY.emptyArchive} />
    </main>
  );
}
