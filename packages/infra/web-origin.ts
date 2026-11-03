import { AlchemyContext } from "alchemy/AlchemyContext";
import { Stage } from "alchemy/Stage";
import { Config, Effect } from "effect";

const workerName = (service: "server" | "web") =>
  Stage.pipe(
    Effect.map((stage) => `acta-${service}-${stage.replaceAll("_", "-")}`)
  );

export const serverName = workerName("server");
export const webName = workerName("web");

const PRODUCTION_DOMAINS = {
  server: "acta-api.adrianayala.mx",
  web: "acta.adrianayala.mx",
} as const;

// Only the `prod` stage gets custom domains; other stages stay on workers.dev.
export const customDomain = (service: keyof typeof PRODUCTION_DOMAINS) =>
  Stage.pipe(
    Effect.map((stage) =>
      stage === "prod" ? PRODUCTION_DOMAINS[service] : undefined
    )
  );

export const webOrigin = Effect.gen(function* webOrigin() {
  if ((yield* AlchemyContext).dev) {
    return "http://localhost:3001";
  }

  const domain = yield* customDomain("web");

  if (domain) {
    return `https://${domain}`;
  }

  const name = yield* webName;
  const subdomain = yield* Config.String("CLOUDFLARE_WORKERS_SUBDOMAIN");

  return `https://${name}.${subdomain}.workers.dev`;
});
