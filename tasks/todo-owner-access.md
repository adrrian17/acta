# Tasks: owner-access

Plan: [plan-owner-access.md](./plan-owner-access.md). Spec: [docs/SPEC-owner-access.md](../docs/SPEC-owner-access.md). "AC n" refers to the spec's acceptance criterion n.

Every task also clears the standing bar: `pnpm check` and `pnpm test` pass, `pnpm env:generate` runs after any `.env.schema` edit, glossary terms (Owner, Instance) are used in code and copy, and no secrets are committed.

## Task 1: Owner ID check and test runner

**Description:** Add the pure Owner check that both auth and api share, and the root test runner it is tested with. This is the first use of `vp test`, so a runner problem surfaces before anything depends on it.

**Spec criteria covered:** Foundation for AC 1, 2 and 5. The spec's `isOwnerGithubId` unit tests.

**Acceptance criteria:**

- [x] `packages/auth/src/owner.ts` exports `GITHUB_PROVIDER_ID = "github"` and `isOwnerGithubId(githubId: string | number, ownerGithubId: string): boolean`, which compares `String(githubId) === ownerGithubId`.
- [x] `owner.test.ts` covers a matching ID, a different ID, a numeric versus a string ID, and leading zeros or whitespace (which never match). It imports from `vite-plus/test`.
- [x] The root `package.json` has `"test": "vp test"`, and `pnpm test` runs the suite.

**Verification:**

- [x] `pnpm test` passes and reports the `owner.test.ts` cases
- [x] `pnpm check` passes

**Dependencies:** None

**Files likely touched:**

- `packages/auth/src/owner.ts` (new)
- `packages/auth/src/owner.test.ts` (new)
- `package.json`

**Estimated scope:** S (3 files)

## Task 2: Deployment configuration for GitHub OAuth and the Owner ID

**Description:** Declare `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `OWNER_GITHUB_ID` in the root env schema, pick them into the server and infra schemas so `alchemy dev` and `alchemy deploy` validate them, and bind them to the server Worker.

**Spec criteria covered:** AC 6.

**Acceptance criteria:**

- [x] The root `.env.schema` declares the three variables as required and sensitive. `OWNER_GITHUB_ID` is `@type=string(matches=regex("^[1-9][0-9]*$"))`, and `apps/server/.env.schema` picks the three.
- [x] `packages/infra/.env.schema` adds the three to the `@import` pick list, and `alchemy.run.ts` passes them to the server Worker: `Config.String` for `GITHUB_CLIENT_ID` and `OWNER_GITHUB_ID`, and `Config.Redacted` for `GITHUB_CLIENT_SECRET`.
- [x] With a missing, empty or non-numeric `OWNER_GITHUB_ID`, or a missing GitHub client variable, env validation fails. With valid values, `pnpm dev` starts.

**Verification:**

- [x] `pnpm env:generate`, then `pnpm check` passes. `ENV.OWNER_GITHUB_ID` is typed as `string` in `apps/server`.
- [x] Manual: in `packages/infra`, run `pnpm exec varlock load` with `OWNER_GITHUB_ID` unset, then set to `abc`, `0` and `012`. Each run fails validation. With a valid ID it passes.
- [x] Manual: `pnpm dev` refuses to start with an invalid value and starts with valid values.

**Dependencies:** None. The manual check needs the dev GitHub OAuth app's credentials in the root `.env`.

**Files likely touched:**

- `.env.schema` (root)
- `apps/server/.env.schema`
- `packages/infra/.env.schema`
- `packages/infra/alchemy.run.ts`

**Estimated scope:** S (3 files)

## Checkpoint: Foundation

- [x] `pnpm test` and `pnpm check` pass
- [x] `pnpm dev` refuses to start with a missing or non-numeric `OWNER_GITHUB_ID`, and starts with valid values

## Task 3: GitHub provider with the Owner guard, and email/password removed

**Description:** Configure Better Auth's `github` social provider with the Owner guard in `mapProfileToUser`, and remove `emailAndPassword`. For a non-Owner profile, the guard throws `new APIError("FOUND", undefined, { Location })`, where `Location` is the flow's `errorURL` from `getOAuthState()` (falling back to `${CORS_ORIGIN}/login`) with `?error=account_rejected`. The mechanism and its evidence are in the plan.

**Spec criteria covered:** AC 2 (unit: the guard), AC 3 (server side). The spec's `mapProfileToUser` guard unit tests.

**Acceptance criteria:**

- [x] `owner.ts` exports `assertOwnerProfile(profile, ownerGithubId, fallbackErrorURL)`. For the Owner's profile it returns normally. For any other profile it throws an `APIError` with `statusCode` 302 and a `Location` ending in `?error=account_rejected`. It never touches the adapter.
- [x] `AuthConfig` gains `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `OWNER_GITHUB_ID`. `createAuth` sets `socialProviders.github` with `mapProfileToUser` calling the guard, and `emailAndPassword` is gone.
- [x] `POST /api/auth/sign-up/email` and `POST /api/auth/sign-in/email` return 400 with `EMAIL_PASSWORD_SIGN_UP_DISABLED` and `EMAIL_PASSWORD_DISABLED`.

**Verification:**

- [x] `pnpm test`: the guard tests run inside `runWithRequestState(new WeakMap(), ...)` from `@better-auth/core/context`. They cover rejection (status, `Location`, error code) and acceptance of the Owner's numeric `id`.
- [x] `pnpm check` passes
- [x] Manual (`pnpm dev`): `curl -i -X POST http://localhost:3000/api/auth/sign-up/email -H 'content-type: application/json' -d '{"email":"a@b.c","password":"x","name":"x"}'` returns 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED`, and the same request to `/sign-in/email` returns 400 `EMAIL_PASSWORD_DISABLED`.
- [x] Manual: `POST /api/auth/sign-in/social` with `{"provider":"github","callbackURL":"<web>/dashboard","errorCallbackURL":"<web>/login"}` and an `origin: <web>` header returns a `github.com/login/oauth/authorize` URL carrying the dev `client_id`.

**Dependencies:** Task 1, Task 2

**Files likely touched:**

- `packages/auth/src/owner.ts`
- `packages/auth/src/owner.test.ts`
- `packages/auth/src/index.ts`

**Estimated scope:** S (3 files)

## Task 4: Login page with "Continue with GitHub" and the rejection message

**Description:** Replace the sign-in and sign-up forms with a single GitHub button that calls `authClient.signIn.social` using absolute `callbackURL` (`/dashboard`) and `errorCallbackURL` (`/login`). `/login` reads `?error` and shows the matching copy. This closes the sign-in flow end to end.

**Spec criteria covered:** AC 1, AC 2 (end to end, row counts), AC 3 (no form in the web app).

**Acceptance criteria:**

- [x] `/login` shows `Sign in to acta` and a `Continue with GitHub` button (`@acta/ui` `Button`). `validateSearch` accepts an optional `error` string. `account_rejected` shows `This GitHub account can't access this acta instance.`, and any other value shows `Sign-in didn't complete. Try again.`
- [x] `sign-in-form.tsx` and `sign-up-form.tsx` are deleted, and `rg "emailAndPassword|signIn.email|signUp.email" apps packages` returns nothing.
- [x] Signing in with the Owner's GitHub account lands on `/dashboard`. Signing in with any other GitHub account lands on `/login?error=account_rejected` and shows the rejection message.

**Verification:**

- [x] `pnpm check` passes (this also regenerates `routeTree.gen.ts` through the web build or dev)
- [x] Manual AC 1: on an empty local D1, sign in as the Owner. One `user` and one `account` row (`provider_id = 'github'`, `account_id = OWNER_GITHUB_ID`) and a `session` exist. Sign out, sign in again: still one `user` and one `account`.
- [x] Manual AC 2: count `user`, `account` and `session` rows, sign in with the second GitHub account, and count again. The counts are identical and the browser is on `/login?error=account_rejected`. Repeat on a fresh local D1 with zero `user` rows.
- [x] Manual: cancel at GitHub's consent screen. `/login` shows the generic message.

**Dependencies:** Task 3

**Files likely touched:**

- `apps/web/src/routes/login.tsx`
- `apps/web/src/components/sign-in-form.tsx` (delete)
- `apps/web/src/components/sign-up-form.tsx` (delete)

**Estimated scope:** S (3 files)

## Checkpoint: Sign-in

- [x] The Owner signs in with one click and lands on `/dashboard`
- [x] Another GitHub account lands on `/login?error=account_rejected`, sees the message, and the `user`/`account`/`session` counts are unchanged, including on an empty database
- [x] Review with the human before Task 5

## Task 5: Owner check in `protectedProcedure`, and redirect to `/login` on `UNAUTHORIZED`

**Description:** Pass `OWNER_GITHUB_ID` into the tRPC context. After the existing session check, `protectedProcedure` confirms that an `account` row exists with `userId = session.user.id`, `providerId = GITHUB_PROVIDER_ID` and `accountId = ctx.ownerGithubId`, and throws `UNAUTHORIZED` otherwise. The web app sends the browser to `/login` when a query fails with `UNAUTHORIZED`.

**Spec criteria covered:** AC 4, AC 5, AC 7.

**Acceptance criteria:**

- [x] `Context` gains `ownerGithubId: string`, and `apps/server/src/context.ts` sets it from `ENV.OWNER_GITHUB_ID`.
- [x] `protectedProcedure` throws `TRPCError({ code: "UNAUTHORIZED" })` with no session, and also when the session's user has no GitHub `account` whose `accountId` equals `ctx.ownerGithubId`. `healthCheck` stays on `publicProcedure`.
- [x] `QueryCache.onError` in `apps/web/src/utils/trpc.ts` sends the browser to `/login` for `UNAUTHORIZED` and keeps the toast for other errors.

**Verification:**

- [x] `pnpm check` and `pnpm test` pass
- [x] Manual AC 4: `curl -i 'http://localhost:3000/trpc/privateData'` with no cookie returns 401 with code `UNAUTHORIZED`.
- [x] Manual AC 7: `curl -i 'http://localhost:3000/trpc/healthCheck'` returns 200 with `"OK"`.
- [x] Manual AC 5: sign in as the Owner, and `/dashboard` loads `privateData`. Change `OWNER_GITHUB_ID` in the root `.env` to another valid ID and restart `pnpm dev`. Calling `privateData` with the same cookie returns `UNAUTHORIZED`, and the web app goes to `/login`. Restore the ID afterwards.

**Dependencies:** Task 1, Task 2. The manual AC 5 check needs Task 4.

**Files likely touched:**

- `packages/api/src/context.ts`
- `packages/api/src/index.ts`
- `apps/server/src/context.ts`
- `apps/web/src/utils/trpc.ts`

**Estimated scope:** M (4 files)

## Checkpoint: Complete

- [x] All seven acceptance criteria pass through their unit test or manual check
- [x] `pnpm check` and `pnpm test` pass
- [x] `rg "emailAndPassword|signIn.email|signUp.email" apps packages` returns nothing
- [x] Ready for review
