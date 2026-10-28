import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { DesktopSidebar, TopBar } from "@/components/sidebar";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();

    if (!session.data) {
      // oxlint-disable-next-line typescript/only-throw-error -- TanStack Router redirects by throwing redirect()
      throw redirect({
        to: "/login",
      });
    }

    return { session };
  },
});

function AuthLayout() {
  return (
    <div className="mx-auto max-w-[60rem] lg:grid lg:grid-cols-[19.5rem_1fr]">
      <DesktopSidebar />
      <div className="min-w-0">
        <TopBar />
        <Outlet />
      </div>
    </div>
  );
}
