import { AlchemyContext } from "alchemy/AlchemyContext";
import { Stage } from "alchemy/Stage";
import { ConfigProvider, Effect } from "effect";
import { expect, test } from "vite-plus/test";

import { serverOrigin, webName, webOrigin } from "./web-origin";

const resolveWeb = async (stage: string, dev: boolean) =>
  await Effect.all({ name: webName, origin: webOrigin }).pipe(
    Effect.provideService(Stage, stage),
    Effect.provideService(AlchemyContext, {
      dotAlchemy: ".alchemy",
      dev,
      adopt: false,
    }),
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown(
          dev ? {} : { CLOUDFLARE_WORKERS_SUBDOMAIN: "example" }
        )
      )
    ),
    Effect.runPromise
  );

test("every preview deploys to the stable preview frontend origin", async () => {
  expect(await resolveWeb("preview", false)).toEqual({
    name: "acta-web-preview",
    origin: "https://acta-web-preview.example.workers.dev",
  });
});

test("production uses its custom domain as the frontend origin", async () => {
  expect(await resolveWeb("prod", false)).toEqual({
    name: "acta-web-prod",
    origin: "https://acta.adrianayala.mx",
  });
});

test("local development needs no Cloudflare subdomain", async () => {
  const web = await resolveWeb("local", true);
  expect(web.origin).toBe("http://localhost:3001");
});

test("the default personal stage uses a valid frontend name and matching origin", async () => {
  expect(await resolveWeb("live_adrrian17", false)).toEqual({
    name: "acta-web-live-adrrian17",
    origin: "https://acta-web-live-adrrian17.example.workers.dev",
  });
});

const resolveServer = async (stage: string) =>
  await serverOrigin.pipe(
    Effect.provideService(Stage, stage),
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({ CLOUDFLARE_WORKERS_SUBDOMAIN: "example" })
      )
    ),
    Effect.runPromise
  );

test("the server origin follows the same stage naming as the deployed Worker", async () => {
  expect(await resolveServer("preview")).toBe(
    "https://acta-server-preview.example.workers.dev"
  );
  expect(await resolveServer("prod")).toBe("https://acta-api.adrianayala.mx");
});
