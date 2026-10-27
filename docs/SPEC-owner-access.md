# Spec: owner-access

Module id: `owner-access` ([capability map](./CAPABILITY-MAP.md)). Depends on: nothing. Vocabulary: [GLOSSARY.md](../GLOSSARY.md). Governing decision: [ADR 0001](./adr/0001-owner-pinned-by-github-account-id.md).

## Objective

Only the Owner can get into an Instance. The Owner signs in with GitHub OAuth. The Instance recognizes them by the numeric GitHub account ID set in deployment configuration, and rejects every other GitHub account, including on the first sign-in of a fresh Instance. Every tRPC procedure that reads or writes content checks, on every call, that the caller is the Owner.

Success means a stranger who finds the Instance's URL cannot sign in, leaves no trace in the database, and cannot call any content procedure. The Owner signs in with one click.

### Decisions taken while specifying

- **The Owner check runs on every content call, not only at sign-in.** It closes the gap where the configured Owner ID changes but the previous account's `user` row and sessions survive.
- **The UI is English only.** There is no language switch and no translation layer. This narrows the brief's "Spanish and English" scope line. Note content is free text in any language.
- **Rejection happens before any database write.** Better Auth creates the `user` row before the `account` row, and D1 has no interactive transactions, so a hook on `account` creation would fire too late and leave an orphan `user` row. The GitHub provider's `mapProfileToUser` receives the raw GitHub profile, including its numeric `id`, inside `getUserInfo`, before any write (verified in `@better-auth/core` 1.7.13, `social-providers/github.mjs`). That is the rejection point.

### Acceptance criteria

1. Signing in with the GitHub account whose numeric ID equals `OWNER_GITHUB_ID` creates the Owner's `user` and `account` rows on first sign-in, resumes them afterwards, and lands on the authenticated area.
2. Signing in with any other GitHub account redirects back to `/login` with the error `account_rejected` and shows the "account rejected" message. The `user`, `account` and `session` row counts are the same before and after the attempt. This also holds on a fresh Instance with zero `user` rows.
3. `POST /api/auth/sign-up/email` and `POST /api/auth/sign-in/email` do not succeed. Better Auth returns a "disabled" or "not found" error, and the web app has no email or password form.
4. Any procedure built on `protectedProcedure`, called without a session, fails with tRPC code `UNAUTHORIZED`.
5. A procedure built on `protectedProcedure`, called with a valid session whose GitHub `account.accountId` is not `OWNER_GITHUB_ID` (simulated by changing the configured ID), fails with `UNAUTHORIZED`.
6. If `OWNER_GITHUB_ID`, `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` is missing, or `OWNER_GITHUB_ID` is not a positive integer, env validation fails at startup and deploy, instead of the server running with no Owner.
7. `healthCheck` stays public.

## Tech Stack

Versions from `pnpm-workspace.yaml`:

- Better Auth 1.7.13 (`better-auth`, `@better-auth/core`, `@better-auth/drizzle-adapter`), built-in `github` social provider
- tRPC ^11.19.0, Hono on Cloudflare Workers
- Drizzle ORM 1.0.0-rc.5 on D1
- varlock 1.23.0 for env schema and validation
- Alchemy 2.0.0-beta.84 (`@alchemy.run/cloudflare`) for bindings
- React 19, TanStack Router, `@acta/ui`

This module adds no new dependencies.

## Commands

```
Install:        pnpm install
Dev (all):      pnpm dev
Dev (server):   pnpm dev:server
Dev (web):      pnpm dev:web
Env types:      pnpm env:generate
Check:          pnpm check            # lint + format + typecheck
Fix:            pnpm fix
Test:           pnpm test             # new root script: "test": "vp test" (Vitest bundled in Vite+)
Deploy:         pnpm deploy
```

## Project Structure

Files this module touches:

```
.env.schema                             → declare GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OWNER_GITHUB_ID
                                          (the root schema; every package picks its items from it)
apps/server/.env.schema                 → add the three to the @import pick list
packages/infra/.env.schema              → add the three to the @import pick list
packages/infra/alchemy.run.ts           → pass the three to the server Worker env
packages/auth/src/index.ts              → AuthConfig gains the three; remove emailAndPassword;
                                          add socialProviders.github with the Owner guard in mapProfileToUser
packages/auth/src/owner.ts              → pure Owner check shared by auth and api (new)
packages/auth/src/owner.test.ts         → unit tests for the Owner check (new)
packages/api/src/context.ts             → Context gains ownerGithubId
packages/api/src/index.ts               → protectedProcedure also verifies the session's GitHub account is the Owner's
apps/server/src/context.ts              → pass ENV.OWNER_GITHUB_ID into the tRPC context
apps/web/src/routes/login.tsx           → single "Continue with GitHub" button and error message
apps/web/src/components/sign-in-form.tsx → delete
apps/web/src/components/sign-up-form.tsx → delete
package.json                            → add "test": "vp test"
packages/db/src/migrations/<first>/     → initial Better Auth migration (generated)
```

`apps/server/cloudflare-env.d.ts` derives from `alchemy.run.ts` and is not edited by hand. `env.ts` files are regenerated with `pnpm env:generate`.

There are no schema changes. The repo had no migrations, so this module adds the first one, generated by `pnpm db:generate` from the existing `schema/auth.ts`: Better Auth's `user`, `session`, `account` and `verification` tables. It adds no content tables or columns. The GitHub account ID lives in `account.accountId` where `account.providerId = 'github'`.

## Interfaces

### Deployment configuration

| Variable | Type | Sensitive | Purpose |
| --- | --- | --- | --- |
| `GITHUB_CLIENT_ID` | string | yes | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | string | yes | GitHub OAuth app client secret (`Config.Redacted` in Alchemy) |
| `OWNER_GITHUB_ID` | string, positive integer | yes | The Owner's numeric GitHub account ID, compared as a string with `account.accountId` |

The GitHub OAuth app's callback URL is `${BETTER_AUTH_URL}/api/auth/callback/github`. Local dev and production need separate OAuth apps because their callback URLs differ.

### Sign-in flow

1. The web app calls `authClient.signIn.social({ provider: "github", callbackURL: <web>/dashboard, errorCallbackURL: <web>/login })`.
2. GitHub redirects to the server callback. Better Auth fetches the GitHub profile and runs `mapProfileToUser(profile)`.
3. If `String(profile.id) !== OWNER_GITHUB_ID`, the guard ends the flow with a redirect to `errorCallbackURL` with `?error=account_rejected`, before any database write. How the guard produces that redirect from inside `mapProfileToUser` (for example by throwing a Better Auth `APIError` that carries a `Location` header) is settled during planning and must be proven by acceptance criterion 2.
4. Otherwise Better Auth creates or resumes the Owner's `user`, `account` and `session` as usual.

### Owner check on content procedures

`protectedProcedure` keeps its name and its current callers. After the existing session check, it confirms that an `account` row exists with `userId = session.user.id`, `providerId = 'github'` and `accountId = ctx.ownerGithubId`. If it doesn't, it throws `TRPCError({ code: "UNAUTHORIZED" })`. Every content procedure in later modules is built on `protectedProcedure`. `publicProcedure` is reserved for `healthCheck`.

### Error codes reaching the web app

| Source | Code | Meaning |
| --- | --- | --- |
| OAuth redirect `?error=` | `account_rejected` | GitHub account is not the Owner |
| OAuth redirect `?error=` | any other value | Sign-in failed for another reason (cancelled, GitHub error, no email on the account) |
| tRPC | `UNAUTHORIZED` | No session, or the session is not the Owner's; the web app sends the browser to `/login` |

The server never sends user-facing text. The web app maps codes to copy.

### UI copy

| Key | Text |
| --- | --- |
| `login.title` | Sign in to acta |
| `login.github` | Continue with GitHub |
| `login.error.accountRejected` | This GitHub account can't access this acta instance. |
| `login.error.generic` | Sign-in didn't complete. Try again. |

## Code Style

Follow [docs/agents/typescript.md](./agents/typescript.md). Use named constants, return early, and throw `TRPCError` with an explicit code. Keep the Owner check a pure function so it can be tested without Better Auth or D1:

```ts
// packages/auth/src/owner.ts
export const GITHUB_PROVIDER_ID = "github";

export function isOwnerGithubId(
  githubId: string | number,
  ownerGithubId: string
): boolean {
  return String(githubId) === ownerGithubId;
}
```

```ts
// packages/api/src/index.ts (shape, not final code)
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  const ownerAccount = await findOwnerAccount(
    ctx.db,
    ctx.session.user.id,
    ctx.ownerGithubId
  );
  if (!ownerAccount) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not the Owner" });
  }

  return await next({ ctx: { ...ctx, session: ctx.session } });
});
```

## Testing Strategy

- **Runner:** `vp test` (Vitest bundled in Vite+), exposed as `pnpm test`. Test files sit next to their source as `*.test.ts`.
- **Unit:** `isOwnerGithubId` covers a matching ID, a different ID, a numeric versus a string ID, and leading zeros or whitespace (which never match).
- **Unit:** the `mapProfileToUser` guard throws or redirects for a non-Owner profile and returns the mapped user for the Owner's profile, with no adapter calls in the reject path.
- **Manual, against `pnpm dev`:** acceptance criteria 1 to 3 with the Owner's GitHub account and one other GitHub account. Count the `user`, `account` and `session` rows in local D1 before and after the rejected attempt.
- **Manual:** acceptance criterion 5 by signing in as the Owner, changing `OWNER_GITHUB_ID`, restarting, and calling a protected procedure.
- No coverage threshold for this module. Every acceptance criterion maps to one test or one manual check above.

## Boundaries

- **Always:** run `pnpm check` and `pnpm test` before calling a task done. Run `pnpm env:generate` after editing any `.env.schema`. Use the glossary terms (Owner, Instance) in code and copy.
- **Ask first:** adding a Better Auth plugin, changing session duration or cookie attributes, adding any column or table, or adding a dependency.
- **Never:** identify the Owner by email. Create a `user` row for a non-Owner account. Re-enable email or password sign-in. Rename Better Auth tables or columns. Hand-edit `env.ts`, `cloudflare-env.d.ts` or migrations. Commit secrets.

## Success Criteria

- All seven acceptance criteria pass, each through its unit test or manual check.
- `pnpm check` and `pnpm test` pass.
- `rg "emailAndPassword|signIn.email|signUp.email" apps packages` returns nothing.
- A deploy with a missing or non-numeric `OWNER_GITHUB_ID` fails env validation.

## Assumptions

- Better Auth's default session lifetime and refresh (7 days, refreshed daily) are kept.
- Better Auth's default GitHub scopes (`read:user`, `user:email`) are kept. The Owner's GitHub account has at least one email, because `user.email` is `NOT NULL`.
- No Instance has been deployed yet, so no email/password users need cleaning up.
- `privateData` and the dashboard route stay as scaffold placeholders until `notes` replaces them.

## Open Questions

- None blocking. How the guard issues its redirect from `mapProfileToUser` is a planning detail, constrained by acceptance criterion 2.
