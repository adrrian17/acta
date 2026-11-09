# Local sign-in goes through a GitHub emulator, wired by a dev-only fetch reroute

`pnpm dev` must start and sign in with no real credentials, so local GitHub OAuth goes to an [emulate](https://emulate.dev/) GitHub on port 4000, started by `packages/auth`'s `dev` script. Its built-in `admin` user (id 2) is the local Owner and `ghost` (id 1) is a rejected account, so the Owner check from ADR 0001 runs unchanged against fake accounts. Better Auth 1.7 lets the GitHub provider override its authorize URL but hardcodes the token endpoint and `api.github.com`, so the server Worker wraps the global `fetch` to send `github.com` and `api.github.com` to the emulator. That wrap, and the authorize override, run only when `GITHUB_EMULATOR_URL` is set, and `alchemy.run.ts` sets it only under `alchemy dev`, so deployed stages never carry it.

## Considered options

- Better Auth's `genericOAuth` plugin for local only. Rejected: a different provider ID, callback route and client call than production, so local sign-in would not exercise the production path.
- Real GitHub OAuth Apps per developer. Rejected: needs real credentials and a GitHub account per Owner identity, which is what this decision removes.

## Consequences

- A root `.env` value for `OWNER_GITHUB_ID` overrides the local default, and the emulator's `admin` is then rejected. Comment it out to sign in locally.
- `OWNER_GITHUB_ID` is not sensitive: it is a public GitHub account ID, and varlock cannot redact a one-character value.
- If Better Auth exposes the token and user endpoints as provider options, replace the fetch reroute with those options.
