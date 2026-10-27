import type { ServerEnv } from "@acta/infra/alchemy.run";

// This file infers types for the cloudflare:workers environment from your Alchemy Worker.
// @see https://alchemy.run/cloudflare/compute/workers

declare global {
  type Env = ServerEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    // oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- declaration merging into Cloudflare.Env needs an interface
    export interface Env extends ServerEnv {}
  }
}
