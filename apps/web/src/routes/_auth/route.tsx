import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

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
  return <Outlet />;
}
