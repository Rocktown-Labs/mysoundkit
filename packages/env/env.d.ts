import type * as Cloudflare from "alchemy/Cloudflare";
import type { server } from "@soundkit/infra/alchemy.run";

// This file infers types for the cloudflare:workers environment from your Alchemy Worker.
// @see https://alchemy.run/cloudflare/compute/workers#async-workers

export type CloudflareEnv = Cloudflare.InferEnv<typeof server> & {
  HYPERDRIVE?: {
    connectionString: string;
  };
};

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
