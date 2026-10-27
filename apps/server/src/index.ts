import { appRouter } from "@acta/api/routers/index";
import { trpcServer } from "@hono/trpc-server";
import { initLogger } from "evlog";
import { createAuthMiddleware } from "evlog/better-auth";
import { evlog } from "evlog/hono";
import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { createAuth } from "./services";

initLogger({
  env: { service: "acta-server" },
});

const identifyUser = createAuthMiddleware(createAuth(), {
  exclude: ["/api/auth/**"],
  maskEmail: true,
});

const app = new Hono<EvlogVariables>();

app.use(evlog());

app.use("*", async (c, next) => {
  await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
  // oxlint-disable-next-line node/callback-return -- Hono middleware awaits next(); it is not a Node callback
  await next();
});

app.use(
  "/*",
  cors({
    origin: ENV.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(
  ["POST", "GET"],
  "/api/auth/*",
  async (c) => await createAuth().handler(c.req.raw)
);

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/trpc",
    router: appRouter,
    createContext: async (_opts, context) => await createContext({ context }),
  })
);

app.get("/", (c) => c.text("OK"));

export default app;
