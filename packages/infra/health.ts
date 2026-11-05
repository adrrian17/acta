import { AlchemyContext } from "alchemy/AlchemyContext";
import { Stage } from "alchemy/Stage";
import { Effect } from "effect";

import { waitUntilHealthy } from "./health-check.ts";
import { serverOrigin, webOrigin } from "./web-origin.ts";

const ATTEMPTS = 12;
const DELAY_MS = 10_000;
const REQUEST_TIMEOUT_MS = 10_000;

const stage = process.argv.at(2);

if (stage === undefined) {
  throw new Error("usage: health.ts <stage>");
}

// Same derivation the deploy uses, so URLs cannot drift from the infra definition.
const target = await Effect.all({
  webOrigin,
  serverOrigin,
}).pipe(
  Effect.provideService(Stage, stage),
  Effect.provideService(AlchemyContext, {
    dotAlchemy: ".alchemy",
    dev: false,
    adopt: false,
  }),
  Effect.runPromise
);

console.log(`Checking ${target.webOrigin} and ${target.serverOrigin}`);

const attempt = await waitUntilHealthy(target, {
  attempts: ATTEMPTS,
  delayMs: DELAY_MS,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
});

console.log(`Healthy on attempt ${attempt}`);
