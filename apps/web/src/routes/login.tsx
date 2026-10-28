import { Button } from "@acta/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

// Matches ACCOUNT_REJECTED_ERROR in @acta/auth; the web app can't import server code.
const ACCOUNT_REJECTED_ERROR = "account_rejected";

const COPY = {
  title: "Sign in to acta",
  github: "Continue with GitHub",
  accountRejected: "This GitHub account can't access this acta instance.",
  generic: "Sign-in didn't complete. Try again.",
} as const;

const loginSearchSchema = z.object({
  error: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  component: RouteComponent,
  validateSearch: loginSearchSchema,
});

async function signInWithGithub() {
  // Absolute URLs: Better Auth resolves relative ones against the server's origin.
  const { error } = await authClient.signIn.social({
    provider: "github",
    callbackURL: `${window.location.origin}/`,
    errorCallbackURL: `${window.location.origin}/login`,
  });

  if (error) {
    toast.error(COPY.generic);
  }
}

function RouteComponent() {
  const { error } = Route.useSearch();

  const errorMessage =
    error === ACCOUNT_REJECTED_ERROR ? COPY.accountRejected : COPY.generic;

  return (
    <div className="mx-auto mt-10 w-full max-w-md space-y-6 p-6">
      <h1 className="text-center text-3xl font-bold">{COPY.title}</h1>

      {error !== undefined && (
        <p role="alert" className="text-destructive text-center">
          {errorMessage}
        </p>
      )}

      <Button
        className="w-full"
        onClick={() => {
          void signInWithGithub();
        }}
      >
        {COPY.github}
      </Button>
    </div>
  );
}
