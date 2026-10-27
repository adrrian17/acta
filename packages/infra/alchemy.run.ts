import { D1, providers, state, Website, Worker } from "@alchemy.run/cloudflare";
import type { InferEnv } from "@alchemy.run/cloudflare";
import { Stack } from "alchemy";
import { Config, Effect } from "effect";
import "varlock/auto-load";

export const db = D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

export const server = Worker("server", {
  main: "../../apps/server/src/index.ts",
  compatibility: {
    flags: ["nodejs_compat"],
  },
  env: {
    DB: db,
    CORS_ORIGIN: Config.String("CORS_ORIGIN"),
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Worker.URL,
  },
  dev: {
    port: 3000,
  },
});

export type ServerEnv = InferEnv<typeof server>;

export default Stack(
  "acta",
  {
    providers: providers(),
    state: state(),
  },
  Effect.gen(function* stack() {
    const serverWorker = yield* server;

    const webWorker = yield* Website.Vite("web", {
      rootDir: "../../apps/web",
      assets: {
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "single-page-application",
      },
      env: {
        VITE_SERVER_URL: serverWorker.url.as<string>(),
      },
      dev: {
        port: 3001,
      },
    });

    return {
      web: webWorker.url,
      server: serverWorker.url,
    };
  })
);
