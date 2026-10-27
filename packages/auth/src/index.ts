import type { Database } from "@acta/db";
import { account, session, user, verification } from "@acta/db/schema/auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";

import { assertOwnerProfile } from "./owner";

export interface AuthConfig {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OWNER_GITHUB_ID: string;
}

export function createAuth(
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = []
) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema: { account, session, user, verification },
    }),
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        mapProfileToUser: async (profile) => {
          await assertOwnerProfile(
            profile,
            env.OWNER_GITHUB_ID,
            `${env.CORS_ORIGIN}/login`
          );

          return {};
        },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
