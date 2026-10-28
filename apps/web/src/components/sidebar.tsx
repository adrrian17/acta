import type { NoteState } from "@acta/api/notes/lifecycle";
import { Button } from "@acta/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@acta/ui/components/sheet";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState, useSearch } from "@tanstack/react-router";
import { Archive, Inbox, Menu, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { COPY } from "@/components/notes/copy";
import { TagPanel } from "@/components/notes/tag-panel";
import UserMenu from "@/components/user-menu";
import { trpc } from "@/utils/trpc";

const NAV_ITEMS: readonly {
  to: "/" | "/archive" | "/trash";
  label: string;
  icon: LucideIcon;
  state: NoteState;
}[] = [
  { to: "/", label: COPY.navTimeline, icon: Inbox, state: "timeline" },
  { to: "/archive", label: COPY.navArchive, icon: Archive, state: "archived" },
  { to: "/trash", label: COPY.navTrash, icon: Trash2, state: "trashed" },
];

function SidebarContent() {
  const counts = useQuery(trpc.notes.counts.queryOptions());
  const search = useSearch({ strict: false });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-semibold">{COPY.appName}</span>
        <div className="flex items-center gap-1">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <nav aria-label={COPY.navLabel} className="grid gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, state }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: true, includeSearch: false }}
            className="text-muted-foreground hover:bg-accent/60 data-[status=active]:bg-accent data-[status=active]:text-accent-foreground data-[status=active]:before:bg-primary relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full data-[status=active]:font-medium"
          >
            <Icon aria-hidden className="size-4" />
            <span className="flex-1">{label}</span>
            <span className="text-muted-foreground text-xs">
              {counts.data?.[state]}
            </span>
          </Link>
        ))}
      </nav>
      <hr />
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <TagPanel active={{ tag: search.tag, untagged: search.untagged }} />
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

export function MobileBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const href = useRouterState({ select: (s) => s.location.href });
  const title = NAV_ITEMS.find((item) => item.to === pathname)?.label;

  // The sheet is open only at the location where it was opened, so navigating closes it.
  const [openedAt, setOpenedAt] = useState<string | null>(null);

  return (
    <header className="bg-background sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-2 lg:hidden">
      <Sheet
        open={openedAt === href}
        onOpenChange={(open) => {
          setOpenedAt(open ? href : null);
        }}
      >
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={COPY.openNav} />
          }
        >
          <Menu aria-hidden />
        </SheetTrigger>
        <SheetContent side="left" showCloseButton={false}>
          <SheetTitle className="sr-only">{COPY.appName}</SheetTitle>
          <SheetDescription className="sr-only">
            {COPY.navLabel}
          </SheetDescription>
          <SidebarContent />
        </SheetContent>
      </Sheet>
      <span className="font-semibold">{title}</span>
    </header>
  );
}
