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
import { Hash } from "lucide-react";
import { useId, useState } from "react";
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
      <AlertDialogTrigger render={<Button variant="ghost" size="xs" />}>
        {COPY.rename}
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
      <AlertDialogTrigger render={<Button variant="ghost" size="xs" />}>
        {COPY.delete}
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

function FilterLink({
  label,
  count,
  filter,
  isActive,
}: {
  label: string;
  count: number;
  filter: TagFilter;
  isActive: boolean;
}) {
  return (
    <Link
      to="/"
      // Clicking the active filter again clears it.
      search={isActive ? {} : filter}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "text-muted-foreground hover:bg-accent/60 flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-xs",
        isActive && "bg-accent text-accent-foreground font-medium"
      )}
    >
      <Hash aria-hidden className="size-3.5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      <span className="text-muted-foreground text-xs">{count}</span>
    </Link>
  );
}

function TagTree({ nodes, active }: { nodes: TagNode[]; active: TagFilter }) {
  return (
    <ul className="grid gap-0.5">
      {nodes.map((node) => (
        <li key={node.path}>
          <div className="group flex items-center">
            <FilterLink
              label={node.name}
              count={node.count}
              filter={{ tag: node.path }}
              isActive={active.tag === node.path}
            />
            <div className="flex lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
              <RenameTag node={node} active={active} />
              <DeleteTag node={node} active={active} />
            </div>
          </div>
          {node.children.length > 0 && (
            <div className="ml-3 border-l pl-1">
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
      <h2 className="sr-only">{COPY.tagsTitle}</h2>
      {tree.data && (
        <>
          <TagTree nodes={tree.data.nodes} active={active} />
          <FilterLink
            label={COPY.untagged}
            count={tree.data.untaggedCount}
            filter={{ untagged: true }}
            isActive={active.untagged === true}
          />
        </>
      )}
    </nav>
  );
}
