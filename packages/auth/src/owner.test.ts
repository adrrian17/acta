import { runWithRequestState } from "@better-auth/core/context";
import { APIError } from "better-auth/api";
import { describe, expect, it } from "vite-plus/test";

import { assertOwnerProfile, isOwnerGithubId } from "./owner";

const OWNER_GITHUB_ID = "1234567";
const FALLBACK_ERROR_URL = "http://localhost:3001/login";

describe("isOwnerGithubId", () => {
  it("matches the Owner's ID", () => {
    expect(isOwnerGithubId("1234567", OWNER_GITHUB_ID)).toBe(true);
  });

  it("rejects a different ID", () => {
    expect(isOwnerGithubId("7654321", OWNER_GITHUB_ID)).toBe(false);
  });

  it("matches a numeric ID against the string ID", () => {
    expect(isOwnerGithubId(1_234_567, OWNER_GITHUB_ID)).toBe(true);
  });

  it("never matches leading zeros or whitespace", () => {
    expect(isOwnerGithubId("01234567", OWNER_GITHUB_ID)).toBe(false);
    expect(isOwnerGithubId(" 1234567", OWNER_GITHUB_ID)).toBe(false);
    expect(isOwnerGithubId("1234567 ", OWNER_GITHUB_ID)).toBe(false);
  });
});

// Better Auth reads OAuth state from per-request storage, which only exists inside an endpoint.
const inRequest = async <T>(fn: () => Promise<T>) =>
  await runWithRequestState(new WeakMap(), fn);

describe("assertOwnerProfile", () => {
  it("accepts the Owner's numeric GitHub id", async () => {
    await expect(
      inRequest(async () => {
        await assertOwnerProfile(
          { id: 1_234_567 },
          OWNER_GITHUB_ID,
          FALLBACK_ERROR_URL
        );
      })
    ).resolves.toBeUndefined();
  });

  it("rejects any other account with a 302 to the error URL", async () => {
    const rejection = inRequest(async () => {
      await assertOwnerProfile(
        { id: 7_654_321 },
        OWNER_GITHUB_ID,
        FALLBACK_ERROR_URL
      );
    });

    await expect(rejection).rejects.toBeInstanceOf(APIError);
    await expect(rejection).rejects.toMatchObject({
      status: "FOUND",
      statusCode: 302,
      headers: {
        Location: "http://localhost:3001/login?error=account_rejected",
      },
    });
  });
});
