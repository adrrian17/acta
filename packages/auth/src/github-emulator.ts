// Better Auth hardcodes GitHub's token and user endpoints, so local dev reroutes them at the fetch layer.
const GITHUB_HOSTS = new Set(["github.com", "api.github.com"]);

/** Wraps `fetchImpl` so requests to GitHub go to the emulator at `emulatorURL`, keeping path, query, method, headers and body. */
export function githubEmulatorFetch(
  emulatorURL: string,
  fetchImpl: typeof fetch
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);

    if (!GITHUB_HOSTS.has(url.hostname)) {
      return await fetchImpl(request);
    }

    return await fetchImpl(
      new Request(new URL(`${url.pathname}${url.search}`, emulatorURL), request)
    );
  };
}
