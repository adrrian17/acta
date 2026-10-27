# Implementation Plan: owner-access

Source: [docs/SPEC-owner-access.md](../docs/SPEC-owner-access.md) (approved). Module id `owner-access`, no dependencies ([capability map](../docs/CAPABILITY-MAP.md)). Governing decision: [ADR 0001](../docs/adr/0001-owner-pinned-by-github-account-id.md). Tasks: [todo-owner-access.md](./todo-owner-access.md) (written after this plan is approved).

## Overview

Replace email/password sign-in with GitHub OAuth, and let only the Owner in. The Owner is the GitHub account whose numeric ID equals `OWNER_GITHUB_ID`. A guard in the GitHub provider's `mapProfileToUser` rejects every other account before Better Auth writes anything. `protectedProcedure` then checks on every call that the session belongs to the Owner's GitHub account. The web app gets a single "Continue with GitHub" button and maps the `account_rejected` code to copy.

## Architecture Decisions

### The rejection mechanism (the detail the spec left for planning)

**Mechanism.** Inside `mapProfileToUser`, when `isOwnerGithubId(profile.id, OWNER_GITHUB_ID)` is false, the guard:

1. reads the current flow's error URL with `getOAuthState()` from `better-auth/api`, which returns the state that the callback has already parsed, including `errorURL` (the client's `errorCallbackURL`);
2. throws `new APIError("FOUND", undefined, { Location: appendQueryParams(errorURL, new URLSearchParams({ error: "account_rejected" })) })`, using `APIError` from `better-auth/api` and `appendQueryParams` from `@better-auth/core/utils/url`. This is the same helper Better Auth uses for its own `?error=` redirects.

If `getOAuthState()` returns `null` (unit tests, or a non-callback path), the guard falls back to `${CORS_ORIGIN}/login`, which is the `errorCallbackURL` the web app sends anyway.

**Evidence** (installed code, `better-auth@1.7.13`, `@better-auth/core@1.7.13`, `better-call@1.4.4`):

| Step | File (under `node_modules/.pnpm/...`) | What it shows |
| --- | --- | --- |
| Guard runs before any write | `@better-auth/core/dist/social-providers/github.mjs`, `getUserInfo` | `await options.mapProfileToUser?.(profile)` runs after the two GitHub API fetches and before returning. It has no adapter access. |
| A throw is not swallowed | `better-auth/dist/oauth2/callback.mjs:39`, `exchangeOAuthCallback` | `provider.getUserInfo(...)` is not inside a `try`. Only `validateAuthorizationCode` (l. 27) and `resolveOAuthAccountKey` (l. 52) are guarded. |
| The throw happens before user/account/session writes | `better-auth/dist/api/routes/callback.mjs` | `exchangeOAuthCallback` runs before `handleOAuthUserInfo`, the only call that creates `user`, `account` and `session`. The `try/catch` around `handleOAuthUserInfo` does not cover the exchange. |
| `errorURL` is available to the guard | `better-auth/dist/oauth2/state.mjs:62-63`, `parseState` | `if (!parsedData.errorURL) parsedData.errorURL = errorURL; await setOAuthState(parsedData)` runs before the exchange. `getOAuthState` reads it back (`better-auth/dist/api/state/oauth.mjs:13`) and is exported from `better-auth/api`. The comment in `state.mjs:45` notes that `errorURL` was origin-validated at sign-in. |
| Request state always exists in an endpoint | `better-auth/dist/api/to-auth-endpoints.mjs:51-52` | Every endpoint call runs inside `runWithRequestState`, so `getOAuthState()` does not throw there. Outside it (unit tests), `getCurrentRequestState` throws, so tests wrap the guard in `runWithRequestState` from `@better-auth/core/context`. |
| A thrown `APIError` becomes the response | `better-auth/dist/api/dispatch.mjs:236-241, 50-63, 260` | `dispatchAuthEndpoint` catches any `APIError` from the endpoint and merges its explicit `headers` (the comment names `location`), then calls `toResponse` with `status: e.statusCode`. `better-call`'s `isAPIError` matches on `instanceof` or `name === "APIError"`. |
| `FOUND` is a 302 like `c.redirect` | `better-call/dist/context.mjs:60-63` | `c.redirect(url)` itself is `new APIError("FOUND", undefined, headers)` with `location` set. Checked in Node: `new APIError("FOUND", undefined, { Location })` gives `statusCode 302`. |
| The redirect is not logged as an error | `better-auth/dist/api/index.mjs:197`, router `onError` | `if (isAPIError(e) && e.status === "FOUND") return;` |
| The state row is consumed | `better-auth/dist/state.mjs:142`, `parseGenericState` | With the default `database` strategy (`context/create-context.mjs:137`), the `verification` row created at sign-in is deleted before the exchange. A completed rejected attempt leaves no row in any table. |

Acceptance criterion 2 (manual, with row counts) is the end-to-end proof. Its unit test proves the throw shape and the `Location` value.

### Other decisions

- **The guard lives in `packages/auth/src/owner.ts`** as `assertOwnerProfile(profile, ownerGithubId, fallbackErrorURL)`, next to the pure `isOwnerGithubId`. `isOwnerGithubId` stays pure, as the spec requires. The spec lists `owner.test.ts` as the only auth test file, so both unit suites go there.
- **`protectedProcedure` queries `account` directly** with `userId = session.user.id`, `providerId = GITHUB_PROVIDER_ID` and `accountId = ctx.ownerGithubId`. This is the spec's `findOwnerAccount`, kept private to `packages/api/src/index.ts`. The existing `account_userId_idx` covers the lookup.
- **`OWNER_GITHUB_ID` is validated by varlock** as `@type=string(matches=regex("^[1-9][0-9]*$"))` in the root `.env.schema`. Varlock 1.23 supports `matches` on `string` (checked in `varlock/dist/env-source-fingerprint-*.mjs`) and deprecates the bare-string pattern in favour of `regex()`, so the value stays a string, as the spec requires. Validation runs wherever `varlock/auto-load` loads `packages/infra/.env.schema`, which is `alchemy dev` (`pnpm dev`) and `alchemy deploy`. That is why the three variables must be added to the infra `@import` pick list, as well as the server's.
- **Alchemy bindings:** `GITHUB_CLIENT_ID` and `OWNER_GITHUB_ID` use `Config.String`, and `GITHUB_CLIENT_SECRET` uses `Config.Redacted`, matching how `BETTER_AUTH_SECRET` is passed today. `cloudflare-env.d.ts` picks the new types up from `alchemy.run.ts`.
- **The web app passes absolute URLs:** `callbackURL: ${window.location.origin}/dashboard` and `errorCallbackURL: ${window.location.origin}/login`. Better Auth resolves relative URLs against the server, which runs on a different origin.
- **`/login` reads `?error` through `validateSearch`.** `account_rejected` maps to `login.error.accountRejected`, and any other value maps to `login.error.generic`.
- **`UNAUTHORIZED` from tRPC sends the browser to `/login`.** The check happens in the existing `QueryCache.onError` in `apps/web/src/utils/trpc.ts`. `/login` is not protected, so this cannot loop.
- **The test runner:** the root script is `"test": "vp test"`. Tests import from `vite-plus/test`. Vitest fails when it finds no test files, so the script lands in the same task as the first test.

## Dependency Graph

```
T1 owner.ts + test runner ─────────┐
                                   ├─► T3 GitHub provider + guard ─► T4 login UI
T2 deployment configuration ───────┤
                                   └─► T5 Owner check in protectedProcedure (manual AC5 needs T4)
```

## Task List

### Phase 1: Foundation

- [ ] Task 1: Owner ID check and test runner (AC 1, 2, 5 foundation)
- [ ] Task 2: Deployment configuration for GitHub OAuth and the Owner ID (AC 6)

### Checkpoint: Foundation

- [ ] `pnpm test` and `pnpm check` pass
- [ ] `pnpm dev` refuses to start with a missing or non-numeric `OWNER_GITHUB_ID`, and starts with valid values

### Phase 2: Sign-in

- [ ] Task 3: GitHub provider with the Owner guard, and email/password removed (AC 2 unit, AC 3 server)
- [ ] Task 4: Login page with "Continue with GitHub" and the rejection message (AC 1, 2, 3 UI)

### Checkpoint: Sign-in

- [ ] The Owner signs in with one click and lands on `/dashboard`
- [ ] Another GitHub account lands on `/login?error=account_rejected`, sees the message, and the `user`/`account`/`session` counts are unchanged, including on an empty database
- [ ] Review with the human before Phase 3

### Phase 3: Content procedures

- [ ] Task 5: Owner check in `protectedProcedure`, and redirect to `/login` on `UNAUTHORIZED` (AC 4, 5, 7)

### Checkpoint: Complete

- [ ] All seven acceptance criteria pass through their unit test or manual check
- [ ] `pnpm check` and `pnpm test` pass
- [ ] `rg "emailAndPassword|signIn.email|signUp.email" apps packages` returns nothing

## Acceptance Criteria Coverage

| AC | Covered by | Proof |
| --- | --- | --- |
| 1 Owner signs in, rows created then resumed | T3, T4 | Manual against `pnpm dev`, twice |
| 2 Other account rejected, no rows, fresh Instance too | T1, T3 (unit), T4 (manual) | `owner.test.ts` plus manual row counts |
| 3 Email endpoints fail, no form | T3 (server), T4 (UI) | `curl` gets `EMAIL_PASSWORD_DISABLED` / `EMAIL_PASSWORD_SIGN_UP_DISABLED`, plus `rg` |
| 4 No session gets `UNAUTHORIZED` | T5 | `curl` on `/trpc/privateData` |
| 5 Session not the Owner's gets `UNAUTHORIZED` | T5 | Manual: change `OWNER_GITHUB_ID`, restart, call |
| 6 Env validation fails on missing or invalid values | T2 | `pnpm dev` and `varlock load` with bad values |
| 7 `healthCheck` stays public | T5 | `curl` on `/trpc/healthCheck` |

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A Better Auth upgrade wraps `getUserInfo` in a `try` | Med: the rejection would arrive as `unable_to_get_user_info` (still no writes, but the wrong message) | Versions are pinned in the catalog. The manual AC 2 check and the evidence table above name the exact lines to re-check on upgrade. |
| `vp test` needs config that the root `vite.config.ts` lacks | Low | Task 1 runs it first, so a failure shows up before anything depends on it. |
| GitHub OAuth apps are not created yet | High: blocks every manual check from Task 2 onward | The human creates a dev OAuth app (callback `http://localhost:3000/api/auth/callback/github`) and a second GitHub account for AC 2 before Task 2's manual check. |
| A stranger who opens the GitHub page and abandons it leaves an expiring `verification` row | Low: not in AC 2's scope (it counts `user`, `account` and `session`), and a completed rejected attempt deletes the row | Accepted as-is. Changing the state strategy would be a spec change. |

## Open Questions

- None blocking.
