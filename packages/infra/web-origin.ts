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

const deployedOrigin = Effect.fn(function* deployedOrigin(
  service: keyof typeof PRODUCTION_DOMAINS
) {
  const domain = yield* customDomain(service);

  if (domain) {
    return `https://${domain}`;
  }

  const name = yield* workerName(service);
  const subdomain = yield* Config.String("CLOUDFLARE_WORKERS_SUBDOMAIN");

  return `https://${name}.${subdomain}.workers.dev`;
});

export const webOrigin = Effect.gen(function* webOrigin() {
  if ((yield* AlchemyContext).dev) {
    return "http://localhost:3001";
  }

  return yield* deployedOrigin("web");
});

// The public URL a deployed stage serves the server on; used by the post-deploy health check.
export const serverOrigin = deployedOrigin("server");
