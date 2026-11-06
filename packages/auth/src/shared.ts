// Dependency-free, so the web app can import what it shares with the auth server.

export const GITHUB_PROVIDER_ID = "github";

/** The web app's sign-in route; failed OAuth flows return there. */
export const LOGIN_PATH = "/login";

/** The `error` query value the login page receives when a non-Owner GitHub account signs in. */
export const ACCOUNT_REJECTED_ERROR = "account_rejected";
