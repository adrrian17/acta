import type { NoteState } from "@acta/api/notes/lifecycle";
import { Button } from "@acta/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@acta/ui/components/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@acta/ui/components/sheet";
import { cn } from "@acta/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState, useSearch } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import {
  Archive,
  ChevronRight,
  Feather,
  Inbox,
  ListTodo,
  Menu,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { COPY } from "@/components/copy";
import { NOTE_COPY } from "@/components/notes/copy";
import { TagPanel } from "@/components/notes/tag-panel";
import { TASK_COPY } from "@/components/tasks/copy";
import UserMenu from "@/components/user-menu";
import { trpc } from "@/utils/trpc";

const NAV_ITEMS: readonly {
  to: LinkProps["to"];
  label: string;
  icon: LucideIcon;
  /** The Note view whose count the entry shows; Tasks show none. */
  state?: NoteState;
}[] = [
  { to: "/", label: NOTE_COPY.navTimeline, icon: Inbox, state: "timeline" },
  {
    to: "/archive",
    label: NOTE_COPY.navArchive,
    icon: Archive,
    state: "archived",
  },
  { to: "/trash", label: NOTE_COPY.navTrash, icon: Trash2, state: "trashed" },
  { to: "/tasks", label: TASK_COPY.navTasks, icon: ListTodo },
];

const TASK_VIEWS = [
  { view: "open", label: TASK_COPY.tabOpen },
  { view: "done", label: TASK_COPY.tabDone },
  { view: "trashed", label: TASK_COPY.tabTrash },
] as const;

function SidebarContent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onTasks = pathname === "/tasks";
  const [tasksOpen, setTasksOpen] = useState(onTasks);
  const [wasOnTasks, setWasOnTasks] = useState(onTasks);

  // Arriving at /tasks any way (link, back, forward) opens the group so the active view shows.
  if (onTasks !== wasOnTasks) {
    setWasOnTasks(onTasks);

    if (onTasks) {
      setTasksOpen(true);
    }
  }

  const counts = useQuery(trpc.notes.counts.queryOptions());
  const taskCounts = useQuery(trpc.tasks.counts.queryOptions());
  const search = useSearch({ strict: false });

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 px-3 py-4">
      <div className="px-1">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Feather aria-hidden className="text-primary size-5" />
          {COPY.appName}
        </span>
      </div>
      <nav aria-label={COPY.navLabel} className="grid gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, state }) => {
          const link = (
            <Link
              to={to}
              activeOptions={{ exact: true, includeSearch: false }}
              className={cn(
                "group text-muted-foreground hover:bg-accent/50 hover:text-foreground data-[status=active]:text-accent-foreground relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                // An open Tasks group highlights the active view instead of its parent.
                !(to === "/tasks" && tasksOpen) &&
                  "data-[status=active]:bg-accent"
              )}
            >
              <Icon aria-hidden className="size-5" strokeWidth={1.75} />
              <span className="flex-1">{label}</span>
              <span className="text-muted-foreground group-data-[status=active]:text-primary text-xs tabular-nums transition-colors">
                {state && counts.data?.[state]}
              </span>
            </Link>
          );

          if (to !== "/tasks") {
            return <Fragment key={to}>{link}</Fragment>;
          }

          return (
            <Collapsible key={to} open={tasksOpen} onOpenChange={setTasksOpen}>
              <div className="relative">
                {link}
                <CollapsibleTrigger
                  render={
                    <Button
                      variant="ghost-static"
                      size="icon-sm"
                      aria-label={TASK_COPY.toggleViews}
                      className="absolute inset-y-0 right-1 my-auto"
                    />
                  }
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      tasksOpen && "rotate-90",
                      pathname === "/tasks" && "text-primary"
                    )}
                  />
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="border-border mt-1 ml-5 grid gap-1 border-l pl-2">
                  {TASK_VIEWS.map(({ view, label: viewLabel }) => (
                    <Link
                      key={view}
                      to="/tasks"
                      search={view === "open" ? {} : { view }}
                      activeOptions={{ exact: true, includeSearch: true }}
                      className="text-muted-foreground hover:bg-accent/50 hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground flex items-center rounded-lg px-3 py-1.5 text-sm"
                    >
                      <span className="flex-1">{viewLabel}</span>
                      <span className="text-xs tabular-nums">
                        {view !== "trashed" && taskCounts.data?.[view]}
                      </span>
                    </Link>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>
      <hr />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <TagPanel active={{ tag: search.tag, untagged: search.untagged }} />
      </div>
      <div className="border-t pt-3">
        <UserMenu />
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-svh border-r lg:block">
      <SidebarContent />
    </aside>
  );
}

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const href = useRouterState({ select: (s) => s.location.href });
  const search = useSearch({ strict: false });
  const title = NAV_ITEMS.find((item) => item.to === pathname)?.label;

  const taskView =
    pathname === "/tasks"
      ? TASK_VIEWS.find(
          (item) => item.view === search.view && item.view !== "open"
        )
      : undefined;

  // The sheet is open only at the location where it was opened, so navigating closes it.
  const [openedAt, setOpenedAt] = useState<string | null>(null);

  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 items-center gap-2 px-3 lg:px-4">
      <Sheet
        open={openedAt === href}
        onOpenChange={(open) => {
          setOpenedAt(open ? href : null);
        }}
      >
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={COPY.openNav}
            />
          }
        >
          <Menu aria-hidden />
        </SheetTrigger>
        <SheetContent side="left">
          <SheetTitle className="sr-only">{COPY.appName}</SheetTitle>
          <SheetDescription className="sr-only">
            {COPY.navLabel}
          </SheetDescription>
          <SidebarContent />
        </SheetContent>
      </Sheet>
      <h1 className="min-w-0 truncate text-sm font-semibold">
        {title}
        {taskView && ` • ${taskView.label}`}
        {pathname === "/" && search.tag !== undefined && ` • #${search.tag}`}
        {pathname === "/" &&
          search.untagged === true &&
          ` • ${NOTE_COPY.untagged}`}
      </h1>
    </header>
  );
}
