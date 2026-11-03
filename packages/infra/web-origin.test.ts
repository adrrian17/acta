import { AlchemyContext } from "alchemy/AlchemyContext";
import { Stage } from "alchemy/Stage";
import { ConfigProvider, Effect } from "effect";
import { expect, test } from "vite-plus/test";

import { webName, webOrigin } from "./web-origin";

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

test("production uses the production frontend origin", async () => {
  expect(await resolveWeb("prod", false)).toEqual({
    name: "acta-web-prod",
    origin: "https://acta-web-prod.example.workers.dev",
  });
});

test("local development needs no Cloudflare subdomain", async () => {
  const web = await resolveWeb("local", true);
  expect(web.origin).toBe("http://localhost:3001");
});
