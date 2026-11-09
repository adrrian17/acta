import { describe, expect, it } from "vite-plus/test";

import { githubEmulatorFetch } from "./github-emulator";

const EMULATOR_URL = "http://localhost:4000";

function recordingFetch() {
  const requests: { request: Request; body: string }[] = [];

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push({ request, body: await request.text() });

    return new Response("ok");
  };

  return { requests, fetchImpl };
}

describe("githubEmulatorFetch", () => {
  it("sends the token exchange to the emulator with its body", async () => {
    const { requests, fetchImpl } = recordingFetch();

    await githubEmulatorFetch(EMULATOR_URL, fetchImpl)(
      "https://github.com/login/oauth/access_token",
      { method: "POST", body: "code=abc" }
    );

    expect(requests[0]?.request.url).toBe(
      "http://localhost:4000/login/oauth/access_token"
    );
    expect(requests[0]?.request.method).toBe("POST");
    expect(requests[0]?.body).toBe("code=abc");
  });

  it("sends GitHub API calls to the emulator with their headers", async () => {
    const { requests, fetchImpl } = recordingFetch();

    await githubEmulatorFetch(EMULATOR_URL, fetchImpl)(
      "https://api.github.com/user/emails?per_page=1",
      { headers: { authorization: "Bearer t" } }
    );

    expect(requests[0]?.request.url).toBe(
      "http://localhost:4000/user/emails?per_page=1"
    );
    expect(requests[0]?.request.headers.get("authorization")).toBe("Bearer t");
  });

  it("leaves other hosts alone", async () => {
    const { requests, fetchImpl } = recordingFetch();

    await githubEmulatorFetch(
      EMULATOR_URL,
      fetchImpl
    )("https://gist.github.com/x");

    expect(requests[0]?.request.url).toBe("https://gist.github.com/x");
  });
});
