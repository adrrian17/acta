import { once } from "node:events";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

import { afterEach, expect, test } from "vite-plus/test";
import { z } from "zod";

import { waitUntilHealthy } from "./health-check.ts";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const servers: Server[] = [];

const listen = async (handler: Handler) => {
  const server = createServer(handler);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = z.object({ port: z.number() }).parse(server.address());

  return `http://127.0.0.1:${port}`;
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(async (server) => {
      server.close();
      server.closeAllConnections();
      await once(server, "close");
    })
  );
});

const html: Handler = (_req, res) => {
  res.end("<html></html>");
};

interface Body {
  result?: { data: string };
  error?: { message: string };
}

const trpc =
  (body: Body | string, status = 200): Handler =>
  (req, res) => {
    if (req.url !== "/trpc/healthCheck") {
      res.statusCode = 404;
      res.end();

      return;
    }

    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };

const fast = { attempts: 3, delayMs: 5, requestTimeoutMs: 200 };
const OK = { result: { data: "OK" } };

test("passes when the frontend responds and healthCheck returns OK", async () => {
  const webOrigin = await listen(html);
  const serverOrigin = await listen(trpc(OK));

  expect(await waitUntilHealthy({ webOrigin, serverOrigin }, fast)).toBe(1);
});

test("fails when the frontend returns an error status", async () => {
  const webOrigin = await listen((_req, res) => {
    res.statusCode = 503;
    res.end();
  });

  const serverOrigin = await listen(trpc(OK));

  await expect(
    waitUntilHealthy({ webOrigin, serverOrigin }, fast)
  ).rejects.toThrow("unhealthy after 3 attempts");
});

test("fails when healthCheck returns an error status", async () => {
  const webOrigin = await listen(html);
  const serverOrigin = await listen(trpc(OK, 500));

  await expect(
    waitUntilHealthy({ webOrigin, serverOrigin }, fast)
  ).rejects.toThrow("unhealthy after 3 attempts");
});

test.each([
  ["a different value", { result: { data: "NOPE" } }],
  ["an error envelope", { error: { message: "boom" } }],
  ["a bare string", "OK"],
])("fails when healthCheck returns %s", async (_label, body) => {
  const webOrigin = await listen(html);
  const serverOrigin = await listen(trpc(body));

  await expect(
    waitUntilHealthy({ webOrigin, serverOrigin }, fast)
  ).rejects.toThrow("unhealthy after 3 attempts");
});

test("fails when the server does not answer within the request timeout", async () => {
  const webOrigin = await listen(html);

  const serverOrigin = await listen(() => {
    // never responds
  });

  await expect(
    waitUntilHealthy(
      { webOrigin, serverOrigin },
      { attempts: 2, delayMs: 5, requestTimeoutMs: 50 }
    )
  ).rejects.toThrow("unhealthy after 2 attempts");
});

test("retries until the deployment becomes healthy", async () => {
  const webOrigin = await listen(html);
  let calls = 0;

  const serverOrigin = await listen((req, res) => {
    calls += 1;

    if (calls < 3) {
      res.statusCode = 502;
      res.end();

      return;
    }

    trpc(OK)(req, res);
  });

  expect(await waitUntilHealthy({ webOrigin, serverOrigin }, fast)).toBe(3);
});

test("stops after the configured attempts", async () => {
  const webOrigin = await listen(html);
  let calls = 0;

  const serverOrigin = await listen((_req, res) => {
    calls += 1;
    res.statusCode = 500;
    res.end();
  });

  await expect(
    waitUntilHealthy({ webOrigin, serverOrigin }, fast)
  ).rejects.toThrow();
  expect(calls).toBe(3);
});
