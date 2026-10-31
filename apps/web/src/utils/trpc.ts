import type { AppRouter } from "@acta/api/routers/index";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  isTRPCClientError,
} from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import { ENV } from "../env.public";

// No session, or not the Owner's: a toast can't fix that, so go sign in.
function redirectIfUnauthorized(error: Error): boolean {
  if (
    isTRPCClientError<AppRouter>(error) &&
    error.data?.code === "UNAUTHORIZED"
  ) {
    window.location.assign("/login");

    return true;
  }

  return false;
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // A mutation with its own onError (the conflict dialog) handles its errors itself.
      if (redirectIfUnauthorized(error) || mutation.options.onError) {
        return;
      }

      toast.error(error.message);
    },
  }),
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (redirectIfUnauthorized(error)) {
        return;
      }

      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: () => {
            query.invalidate();
          },
        },
      });
    },
  }),
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${ENV.VITE_SERVER_URL.replace(/\/$/u, "")}/trpc`,
      async fetch(url, options) {
        return await fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

/** Refetches every Note list and the tag panel after a write. */
export async function invalidateNotes() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: trpc.notes.pathKey() }),
    queryClient.invalidateQueries({ queryKey: trpc.tags.pathKey() }),
  ]);
}

/** Refetches every Task view after a write. */
export async function invalidateTasks() {
  await queryClient.invalidateQueries({ queryKey: trpc.tasks.pathKey() });
}
