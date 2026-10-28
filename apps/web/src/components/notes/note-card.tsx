import type { Note } from "@acta/api/notes/note";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@acta/ui/components/alert-dialog";
import { Button } from "@acta/ui/components/button";
import { Card, CardContent, CardFooter } from "@acta/ui/components/card";
import { useMutation } from "@tanstack/react-query";
import { Pin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateNotes, queryClient, trpc } from "@/utils/trpc";

import { ConflictDialog } from "./conflict-dialog";
import { COPY } from "./copy";
import { NoteEditor } from "./note-editor";
import { NotePreview } from "./note-preview";

const onSuccess = invalidateNotes;

// The card is out of date: the Note changed, is gone, or is no longer in that state.
const STALE_NOTE_CODES = new Set([
  "CONFLICT",
  "NOT_FOUND",
  "PRECONDITION_FAILED",
]);

function onError(error: { message: string; data?: { code?: string } | null }) {
  const code = error.data?.code;

  if (code !== undefined && STALE_NOTE_CODES.has(code)) {
    void invalidateNotes();
  }

  toast.error(error.message);
}

export function NoteCard({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  const versioned = { id: note.id, version: note.version };

  // The local edit that lost a version check, kept until Reload or Overwrite.
  const [conflict, setConflict] = useState<string | null>(null);

  const update = useMutation(
    trpc.notes.update.mutationOptions({
      onSuccess: async () => {
        setConflict(null);
        setEditing(false);
        await invalidateNotes();
      },
      onError: (error, variables) => {
        if (error.data?.code === "CONFLICT") {
          setConflict(variables.content);

          return;
        }

        onError(error);
      },
    })
  );

  const reload = () => {
    setConflict(null);
    setEditing(false);
    void invalidateNotes();
  };

  const overwrite = async (content: string) => {
    try {
      const current = await queryClient.query(
        trpc.notes.get.queryOptions({ id: note.id }, { staleTime: 0 })
      );

      update.mutate({ id: note.id, version: current.version, content });
    } catch {
      // The Note is gone; the query cache already reported it. Drop the stale card.
      setConflict(null);
      void invalidateNotes();
    }
  };

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
      <Card>
        <CardContent>
          <NoteEditor
            label={COPY.editorLabel}
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
            open={conflict !== null}
            pending={update.isPending}
            onClose={() => {
              setConflict(null);
            }}
            onReload={reload}
            onOverwrite={() => {
              if (conflict !== null) {
                void overwrite(conflict);
              }
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="relative">
        {note.pinned && (
          <Pin
            aria-label={COPY.pinned}
            className="text-muted-foreground absolute top-0 right-4 size-4"
          />
        )}
        <NotePreview content={note.content} />
        {note.purgeAt !== null && (
          <p className="text-muted-foreground mt-2 text-xs">
            {COPY.purgeAt(new Date(note.purgeAt).toLocaleDateString())}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <div className="flex flex-wrap gap-1">
          {note.state === "timeline" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditing(true);
                }}
              >
                {COPY.edit}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setPinned.mutate({ ...versioned, pinned: !note.pinned });
                }}
              >
                {note.pinned ? COPY.unpin : COPY.pin}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  archive.mutate(versioned);
                }}
              >
                {COPY.archive}
              </Button>
            </>
          )}
          {note.state === "archived" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                unarchive.mutate(versioned);
              }}
            >
              {COPY.unarchive}
            </Button>
          )}
          {note.state === "trashed" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  restore.mutate(versioned);
                }}
              >
                {COPY.restore}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm" disabled={busy} />
                  }
                >
                  {COPY.deletePermanently}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {COPY.deletePermanentlyConfirm}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{COPY.cancel}</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={deletePermanently.isPending}
                      onClick={() => {
                        deletePermanently.mutate({ id: note.id });
                      }}
                    >
                      {COPY.deletePermanently}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                trash.mutate(versioned);
              }}
            >
              {COPY.trash}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
