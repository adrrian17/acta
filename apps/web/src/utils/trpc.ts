import type { AppRouter } from "@acta/api/routers/index";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  isTRPCClientError,
} from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import { ENV } from "../env.public";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // No session, or not the Owner's: a toast can't fix that, so go sign in.
      if (
        isTRPCClientError<AppRouter>(error) &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        window.location.assign("/login");

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
