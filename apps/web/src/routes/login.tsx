import { Button } from "@acta/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@acta/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, Feather } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

// Matches ACCOUNT_REJECTED_ERROR in @acta/auth; the web app can't import server code.
const ACCOUNT_REJECTED_ERROR = "account_rejected";

const COPY = {
  appName: "acta",
  title: "Sign in to acta",
  tagline: "Your notes and tasks, in one place.",
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

// lucide-react ships no brand icons, so the GitHub mark is inlined.
function GithubMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function RouteComponent() {
  const { error } = Route.useSearch();

  const errorMessage =
    error === ACCOUNT_REJECTED_ERROR ? COPY.accountRejected : COPY.generic;

  return (
    <main className="grid min-h-svh place-items-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <span className="flex items-center justify-center gap-2 text-sm font-semibold">
            <Feather aria-hidden className="text-primary size-5" />
            {COPY.appName}
          </span>
          <CardTitle>
            <h1>{COPY.title}</h1>
          </CardTitle>
          <CardDescription>{COPY.tagline}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {error !== undefined && (
              <p
                role="alert"
                className="text-destructive flex items-start gap-2 text-sm"
              >
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {errorMessage}
              </p>
            )}
            <Button
              className="w-full"
              onClick={() => {
                void signInWithGithub();
              }}
            >
              <GithubMark />
              {COPY.github}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
