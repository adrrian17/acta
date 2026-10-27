export const GITHUB_PROVIDER_ID = "github";

/** Compares as strings so `account.accountId` and GitHub's numeric `id` share one check. */
export function isOwnerGithubId(
  githubId: string | number,
  ownerGithubId: string
): boolean {
  return String(githubId) === ownerGithubId;
}
