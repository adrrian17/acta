import { describe, expect, it } from "vite-plus/test";

import { isOwnerGithubId } from "./owner";

const OWNER_GITHUB_ID = "1234567";

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
