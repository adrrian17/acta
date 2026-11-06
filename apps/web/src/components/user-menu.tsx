import { Button } from "@acta/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@acta/ui/components/dropdown-menu";
import { Skeleton } from "@acta/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-9 w-full" />;
  }

  if (!session) {
    return (
      <Link to="/login">
        <Button variant="outline" className="w-full justify-start">
          Sign in
        </Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="w-full justify-start" />}
      >
        <span className="truncate">{session.user.name}</span>
        <ChevronsUpDown aria-hidden className="text-muted-foreground ml-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {/* The popup is as wide as the trigger, so a long email wraps instead of clipping. */}
            <span className="break-all">{session.user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ModeToggle />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              void authClient.signOut({
                fetchOptions: {
                  onSuccess: async () => {
                    await navigate({
                      to: "/",
                    });
                  },
                },
              });
            }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
