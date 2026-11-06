import type { Database } from "@acta/db";
import { appendQueryParams } from "@better-auth/core/utils/url";
import { APIError, getOAuthState } from "better-auth/api";

import { ACCOUNT_REJECTED_ERROR, GITHUB_PROVIDER_ID } from "./shared";

/** Compares as strings so `account.accountId` and GitHub's numeric `id` share one check. */
export function isOwnerGithubId(
  githubId: string | number,
  ownerGithubId: string
): boolean {
  return String(githubId) === ownerGithubId;
}

/**
 * Runs inside the GitHub provider's `mapProfileToUser`, before Better Auth writes any row.
 * A thrown `APIError("FOUND")` escapes the OAuth callback as a 302 to the flow's error URL,
 * so a non-Owner account leaves no `user`, `account` or `session` behind.
 */
export async function assertOwnerProfile(
  profile: { id: string | number },
  ownerGithubId: string,
  fallbackErrorURL: string
): Promise<void> {
  if (isOwnerGithubId(profile.id, ownerGithubId)) {
    return;
  }

  const state = await getOAuthState();
  const errorURL = state?.errorURL ?? fallbackErrorURL;
  throw new APIError("FOUND", undefined, {
    Location: appendQueryParams(
      errorURL,
      new URLSearchParams({ error: ACCOUNT_REJECTED_ERROR })
    ),
  });
}

/**
 * Whether `userId` signed in with the Owner's GitHub account. Checked on every call:
 * a session from a previous Owner survives a change to OWNER_GITHUB_ID.
 */
export async function isOwnerUser(
  db: Database,
  userId: string,
  ownerGithubId: string
): Promise<boolean> {
  const account = await db.query.account.findFirst({
    columns: { id: true },
    where: { userId, providerId: GITHUB_PROVIDER_ID, accountId: ownerGithubId },
  });

  return account !== undefined;
}
