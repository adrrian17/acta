import type { TagNode } from "@acta/api/notes/tag-tree";
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
import { Input } from "@acta/ui/components/input";
import { Label } from "@acta/ui/components/label";
import { cn } from "@acta/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Hash, Pencil, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { invalidateNotes, trpc } from "@/utils/trpc";

import { COPY } from "./copy";

interface TagFilter {
  tag?: string;
  untagged?: true;
}

function useTagMutationOptions(path: string, active: TagFilter) {
  const navigate = useNavigate();

  return {
    onSuccess: async ({
      changed,
      skipped,
    }: {
      changed: number;
      skipped: number;
    }) => {
      toast.success(COPY.tagsResult(changed, skipped));

      // The filtered Tag may no longer exist; fall back to the whole Timeline.
      if (
        active.tag !== undefined &&
        (active.tag === path || active.tag.startsWith(`${path}/`))
      ) {
        await navigate({ to: "/", search: {} });
      }

      await invalidateNotes();
    },
  };
}

function RenameTag({ node, active }: { node: TagNode; active: TagFilter }) {
  const [to, setTo] = useState("");
  const inputId = useId();
  const target = to.trim().replace(/^#/u, "").toLowerCase();

  const rename = useMutation(
    trpc.tags.rename.mutationOptions(useTagMutationOptions(node.path, active))
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`${COPY.rename} #${node.path}`}
            title={COPY.rename}
          />
        }
      >
        <Pencil aria-hidden />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {target === ""
              ? `${COPY.rename} #${node.path}`
              : COPY.renameConfirm(node.path, target, node.count)}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={inputId}>{COPY.renameLabel}</Label>
          <Input
            id={inputId}
            value={to}
            placeholder={node.path}
            onChange={(event) => {
              setTo(event.target.value);
            }}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{COPY.cancel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={target === "" || target === node.path || rename.isPending}
            onClick={() => {
              rename.mutate({ from: node.path, to: target });
            }}
          >
            {COPY.rename}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteTag({ node, active }: { node: TagNode; active: TagFilter }) {
  const remove = useMutation(
    trpc.tags.delete.mutationOptions(useTagMutationOptions(node.path, active))
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`${COPY.delete} #${node.path}`}
            title={COPY.delete}
          />
        }
      >
        <Trash2 aria-hidden />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {COPY.deleteConfirm(node.path, node.count)}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{COPY.cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate({ tag: node.path });
            }}
          >
            {COPY.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FilterRow({
  label,
  filter,
  isActive,
  actions,
}: {
  label: string;
  filter: TagFilter;
  isActive: boolean;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        // A border, not a ring: the scrolling sidebar clips anything drawn outside the box.
        "group hover:bg-muted flex items-center gap-1 rounded-md border border-transparent pr-1 transition-colors",
        isActive && "bg-accent hover:bg-accent border-primary/60"
      )}
    >
      <Link
        to="/"
        // Clicking the active filter again clears it.
        search={isActive ? {} : filter}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "text-muted-foreground group-hover:text-foreground flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm",
          isActive &&
            "text-accent-foreground group-hover:text-accent-foreground font-medium"
        )}
      >
        <Hash aria-hidden className="size-4 shrink-0" strokeWidth={1.5} />
        <span className="flex-1 truncate">{label}</span>
      </Link>
      {actions}
    </div>
  );
}

function TagTree({ nodes, active }: { nodes: TagNode[]; active: TagFilter }) {
  return (
    <ul className="grid gap-1">
      {nodes.map((node) => (
        <li key={node.path} className="grid gap-1">
          <FilterRow
            label={node.name}
            filter={{ tag: node.path }}
            isActive={active.tag === node.path}
            actions={
              // Focus keeps them reachable by keyboard; touch screens have no hover.
              <div className="text-muted-foreground flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                <RenameTag node={node} active={active} />
                <DeleteTag node={node} active={active} />
              </div>
            }
          />
          {node.children.length > 0 && (
            <div className="ml-3 border-l pl-2">
              <TagTree nodes={node.children} active={active} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TagPanel({ active }: { active: TagFilter }) {
  const tree = useQuery(trpc.tags.tree.queryOptions());

  return (
    <nav
      aria-label={COPY.tagsTitle}
      className="grid content-start gap-1 text-sm"
    >
      <h2 className="text-muted-foreground px-1 pb-1 text-xs">
        {COPY.tagsTitle}
      </h2>
      {tree.data && (
        <>
          <FilterRow
            label={COPY.untagged}
            filter={{ untagged: true }}
            isActive={active.untagged === true}
          />
          {tree.data.nodes.length === 0 ? (
            <p className="text-muted-foreground px-1 pt-1 text-xs">
              {COPY.noTags}
            </p>
          ) : (
            <TagTree nodes={tree.data.nodes} active={active} />
          )}
        </>
      )}
    </nav>
  );
}
