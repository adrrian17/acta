import type { Note } from "@acta/api/notes/note";
import { Button } from "@acta/ui/components/button";
import { Card, CardContent } from "@acta/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@acta/ui/components/dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Ellipsis, Pin } from "lucide-react";
import { useState } from "react";

import { ConflictDialog } from "@/components/conflict-dialog";
import { COPY } from "@/components/copy";
import { DeleteDialog } from "@/components/delete-dialog";
import { formatDate } from "@/components/format-date";
import { useNow } from "@/components/use-now";
import { itemErrorHandler, useEditConflict } from "@/components/versioned-item";
import { invalidateNotes, queryClient, trpc } from "@/utils/trpc";

import { NOTE_COPY } from "./copy";
import { NoteEditor } from "./note-editor";
import { NotePreview } from "./note-preview";
import { relativeTime } from "./relative-time";
import { withoutTags } from "./without-tags";

const onSuccess = invalidateNotes;
const onError = itemErrorHandler(invalidateNotes);

export function NoteCard({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  const body = withoutTags(note.content, note.tags);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const now = useNow();
  const versioned = { id: note.id, version: note.version };

  const conflict = useEditConflict<string>(invalidateNotes);

  const update = useMutation(
    trpc.notes.update.mutationOptions({
      onSuccess: async () => {
        conflict.clear();
        setEditing(false);
        await invalidateNotes();
      },
      onError: (error, { content }) => {
        conflict.onUpdateError(error, content);
      },
    })
  );

  const setPinned = useMutation(
    trpc.notes.setPinned.mutationOptions({ onSuccess, onError })
  );

  const archive = useMutation(
    trpc.notes.archive.mutationOptions({ onSuccess, onError })
  );

  const unarchive = useMutation(
    trpc.notes.unarchive.mutationOptions({ onSuccess, onError })
  );

  const trash = useMutation(
    trpc.notes.trash.mutationOptions({ onSuccess, onError })
  );

  const restore = useMutation(
    trpc.notes.restore.mutationOptions({ onSuccess, onError })
  );

  const deletePermanently = useMutation(
    trpc.notes.deletePermanently.mutationOptions({ onSuccess, onError })
  );

  const busy = [
    update,
    setPinned,
    archive,
    unarchive,
    trash,
    restore,
    deletePermanently,
  ].some((mutation) => mutation.isPending);

  if (editing) {
    return (
      <div className="bg-card focus-within:border-ring/60 rounded-xl border transition-colors">
        <NoteEditor
          label={NOTE_COPY.editorLabel}
          initialContent={note.content}
          saving={update.isPending}
          onSave={(content) => {
            update.mutate({ ...versioned, content });
          }}
          onCancel={() => {
            setEditing(false);
          }}
        />
        <ConflictDialog
          open={conflict.fields !== null}
          title={NOTE_COPY.conflictTitle}
          pending={update.isPending}
          onClose={() => {
            conflict.clear();
          }}
          onReload={() => {
            setEditing(false);
            conflict.reload();
          }}
          onOverwrite={() => {
            void conflict.overwrite(
              async () => {
                const current = await queryClient.query(
                  trpc.notes.get.queryOptions({ id: note.id }, { staleTime: 0 })
                );

                return current.version;
              },
              (version, content) => {
                update.mutate({ id: note.id, version, content });
              }
            );
          }}
        />
      </div>
    );
  }

  return (
    <Card size="sm">
      <CardContent>
        <div className="grid gap-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <time
              dateTime={new Date(note.createdAt).toISOString()}
              title={new Date(note.createdAt).toLocaleString()}
            >
              {relativeTime(note.createdAt, now)}
            </time>
            {note.pinned && (
              <Pin aria-label={NOTE_COPY.pinned} className="size-3.5" />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    // Negative margins keep the 32px target without padding the row.
                    className="-my-1.5 -mr-2 ml-auto"
                    aria-label={NOTE_COPY.noteActions}
                  />
                }
              >
                <Ellipsis aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {note.state === "timeline" && (
                  <>
                    <DropdownMenuItem
                      disabled={busy}
                      onClick={() => {
                        setEditing(true);
                      }}
                    >
                      {COPY.edit}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={busy}
                      onClick={() => {
                        setPinned.mutate({
                          ...versioned,
                          pinned: !note.pinned,
                        });
                      }}
                    >
                      {note.pinned ? NOTE_COPY.unpin : NOTE_COPY.pin}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={busy}
                      onClick={() => {
                        archive.mutate(versioned);
                      }}
                    >
                      {NOTE_COPY.archive}
                    </DropdownMenuItem>
                  </>
                )}
                {note.state === "archived" && (
                  <DropdownMenuItem
                    disabled={busy}
                    onClick={() => {
                      unarchive.mutate(versioned);
                    }}
                  >
                    {NOTE_COPY.unarchive}
                  </DropdownMenuItem>
                )}
                {note.state === "trashed" ? (
                  <>
                    <DropdownMenuItem
                      disabled={busy}
                      onClick={() => {
                        restore.mutate(versioned);
                      }}
                    >
                      {COPY.restore}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={busy}
                      onClick={() => {
                        setConfirmingDelete(true);
                      }}
                    >
                      {COPY.deletePermanently}
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    disabled={busy}
                    onClick={() => {
                      trash.mutate(versioned);
                    }}
                  >
                    {COPY.trash}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Tags render as the chips below, so the card hides them from the text. */}
          {body.children.length > 0 && <NotePreview content={body} />}
          {note.purgeAt !== null && (
            <p className="text-muted-foreground text-xs">
              {COPY.purgeAt(formatDate(note.purgeAt))}
            </p>
          )}
          {note.tags.length > 0 && (
            <ul className="flex flex-wrap gap-x-1.5 gap-y-2">
              {note.tags.map((tag) => (
                <li key={tag} className="max-w-full">
                  <Link
                    to="/"
                    search={{ tag }}
                    // The hit area grows only into the row gap, so wrapped chips never overlap.
                    className="bg-accent text-accent-foreground hover:bg-accent/70 relative block max-w-full rounded-full px-2 py-0.5 text-xs [overflow-wrap:anywhere] after:absolute after:inset-x-0 after:-inset-y-1"
                  >
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
      <DeleteDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={NOTE_COPY.deletePermanentlyConfirm}
        pending={deletePermanently.isPending}
        onDelete={() => {
          deletePermanently.mutate({ id: note.id });
        }}
      />
    </Card>
  );
}
