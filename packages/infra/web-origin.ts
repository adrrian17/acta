import { AlchemyContext } from "alchemy/AlchemyContext";
import { Stage } from "alchemy/Stage";
import { Config, Effect } from "effect";

export const webName = Stage.pipe(Effect.map((stage) => `acta-web-${stage}`));

export const webOrigin = Effect.gen(function* webOrigin() {
  if ((yield* AlchemyContext).dev) {
    return "http://localhost:3001";
  }

  const name = yield* webName;
  const subdomain = yield* Config.String("CLOUDFLARE_WORKERS_SUBDOMAIN");

  return `https://${name}.${subdomain}.workers.dev`;
});
