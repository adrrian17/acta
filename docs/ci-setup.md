# Configure CI deployments

Infisical is used only by `.github/workflows/deploy.yml`. Local development uses inert placeholders from `.env.schema`. GitHub OAuth needs real credentials to sign in locally.

## Configure Infisical and GitHub

1. In Infisical, create environments with slugs `preview` and `prod`.
2. In each environment's root secret path `/`, add `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OWNER_GITHUB_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_WORKERS_SUBDOMAIN`. Use a random auth secret of at least 32 characters. Use the numeric GitHub account ID for the Owner.
3. In Cloudflare **Workers & Pages**, find the account's `workers.dev` subdomain. Set `CLOUDFLARE_WORKERS_SUBDOMAIN` to that label alone, without `https://` or `.workers.dev`.
4. Give the Cloudflare API token access to the target account's Workers Scripts, D1, Durable Objects, and Secrets Store. Alchemy uses Workers preview sessions to recover state-store credentials on fresh runners. The account needs Secrets Store enabled and an active `workers.dev` subdomain. Prefer separate Cloudflare accounts and tokens for preview and production when isolation is required.
5. In Infisical, create two Machine Identities with OIDC Auth, one for preview and one for production. Infisical matches a single subject per identity, so each identity gets exactly one. Set the issuer to `https://token.actions.githubusercontent.com` and the audience to `https://github.com/<owner>` on both. Do not use a wildcard repository subject.
   - Preview: subject `repo:<owner>@<owner-id>/<repo>@<repo-id>:pull_request`. Grant read access to the `preview` environment only.
   - Production: subject `repo:<owner>@<owner-id>/<repo>@<repo-id>:ref:refs/heads/main`. Grant read access to the `prod` environment only.

   Repositories created after 2026-07-15 use immutable subjects that include the owner and repository IDs. Get the exact prefix with `gh api repos/<owner>/<repo>/actions/oidc/customization/sub` (`sub_claim_prefix`). GitHub's docs show no `pull_request` example in the immutable format, so confirm the preview subject against a real token before relying on it. Restricting an identity to one environment needs a custom project role with environment-scoped permissions, which Infisical documents as an Enterprise feature. Without that, either identity can read both environments, so do not rely on this separation.

6. In GitHub **Settings > Secrets and variables > Actions > Variables**, set `INFISICAL_PREVIEW_IDENTITY_ID`, `INFISICAL_PRODUCTION_IDENTITY_ID`, and `INFISICAL_PROJECT_SLUG`. The action uses Infisical Cloud US by default. For another region or instance, set the `domain` input of the Infisical step in the workflow.

Do not store `STAGE`, `CI`, `NODE_ENV`, `VARLOCK_ENV`, or other runner control variables in that Infisical path. The action exports every secret there to subsequent steps. Do not add `CORS_ORIGIN`, `BETTER_AUTH_URL`, or `VITE_SERVER_URL` for deployment. Alchemy derives these URLs.

## Deployment behavior

| Trigger                      | Alchemy stage | Infisical slug | VARLOCK_ENV  |
| ---------------------------- | ------------- | -------------- | ------------ |
| Same-repository pull request | `preview`     | `preview`      | `preview`    |
| Push to `main`               | `prod`        | `prod`         | `production` |

The workflow sets `NODE_ENV=production` for both environments. Varlock 1.23 also infers environments from GitHub branch metadata, but the explicit flag ties validation to the deployment event. Missing required deployment values fail validation. Process env overrides schema defaults. No Infisical plugin or credentials are needed locally.

Fork pull requests skip the deploy job. Same-repository PR code runs with preview credentials, so only trusted contributors may create those branches. Preview jobs use the preview identity, whose subject is `pull_request` only, so they cannot obtain the production identity's token grant.

All same-repository pull requests share the fixed `preview` stage, so the preview URLs never change between PRs. The frontend Worker has an explicit name `acta-web-<stage>`. Its URL is `https://acta-web-<stage>.<subdomain>.workers.dev`. The server Worker also has an explicit name `acta-server-<stage>`, with URL `https://acta-server-<stage>.<workers-subdomain>.workers.dev`. Preview uses `acta-server-preview`, and production uses `acta-server-prod`. The server receives that exact frontend origin for CORS and Better Auth's trusted origins. `BETTER_AUTH_URL` uses Alchemy's `Worker.URL`, and the frontend receives the deployed server URL through `VITE_SERVER_URL`. Local Alchemy dev uses `http://localhost:3001` for the frontend origin.

Changing an existing frontend from Alchemy's generated name to this explicit name changes its public URL. Review the resource replacement before applying this change to an existing installation. Changing an existing server from its generated name to `acta-server-<stage>` replaces that Worker and changes its public URL once. Update the corresponding GitHub OAuth app callback after the rename. The D1 `database` resource and its binding remain unchanged, so this replacement does not delete the database. Keep the same stage and state store, and review the deployment plan for the Worker replacement before applying it.

The `prod` stage also serves on custom domains: `acta.adrianayala.mx` (web) and `acta-api.adrianayala.mx` (server). They are declared in `packages/infra/web-origin.ts`. The `adrianayala.mx` zone must exist in the Cloudflare account, and the API token needs DNS edit and zone read access on it. Alchemy creates the DNS records and certificates. Other stages stay on `workers.dev`. The production Workers have `workers.dev` disabled, including version preview URLs, so they answer only on the custom domains.

## Persistent state and the shared preview

The pinned Alchemy `2.0.0-beta.84` uses `state()` from `@alchemy.run/cloudflare`. State persists remotely in the account's `alchemy-state-store` Worker and Durable Object. Authentication and encryption keys live in Cloudflare Secrets Store. Fresh CI runners recover access using the Cloudflare API token. No local state cache or `ALCHEMY_PASSWORD` is required by this backend.

`--yes` permits initial state-store bootstrap and upgrades in CI. Keep the same account and shared state store across deploys. Do not delete the state-store Worker, its Durable Object, or its Secrets Store entries. Losing them can orphan deployed resources.

The `preview` stage is a single shared environment. Each deploy overwrites the previous one, so the preview shows the most recently deployed PR, and its D1 data persists across PRs. Closing a PR does not destroy it. Deploys of one stage run one at a time, with cancellation disabled, so state is never written concurrently. A queued run is replaced by a newer queued run, so only the latest pending deploy runs. To remove the preview, run `alchemy destroy --stage preview` manually.

## Verify after setup

1. Open a trusted same-repository PR. Confirm its deploy job succeeds and records distinct web and server URLs.
2. Open the web URL (`https://acta-web-preview.<subdomain>.workers.dev`). Confirm requests to the server pass CORS and that the server trusts only that preview's frontend origin.
3. Register the preview GitHub OAuth app with callback `https://acta-server-preview.<workers-subdomain>.workers.dev/api/auth/callback/github`. Replace `<workers-subdomain>` with the account's subdomain label. Use `https://acta-api.adrianayala.mx/api/auth/callback/github` for the production OAuth app. Better Auth is mounted on the server at `/api/auth/*`. Confirm the server URL against the deploy job output. The preview URL is the same for every PR, so no per-PR OAuth setup is needed.
4. Open a second PR and confirm it deploys to the same web and server URLs.
5. Push the reviewed change to `main` when ready to deploy production.

No workflow or cloud operation was run as part of the local verification. External setup and authenticated deployment checks remain pending.

References: [Varlock builtin environment detection](https://varlock.dev/reference/builtin-variables/), [Infisical action inputs](https://github.com/Infisical/secrets-action/tree/v1.0.9), and [Alchemy state store](https://alchemy.run/state-store/).
