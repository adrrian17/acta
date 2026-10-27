import { appendQueryParams } from "@better-auth/core/utils/url";
import { APIError, getOAuthState } from "better-auth/api";

export const GITHUB_PROVIDER_ID = "github";

export const ACCOUNT_REJECTED_ERROR = "account_rejected";

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
