import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";
import { Worker } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/website/.env" });
config({ path: "../../apps/server/.env" });

const app = await alchemy("soundkit");

export const web = await TanStackStart("web", {
  adopt: true,
  bindings: {
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    DATABASE_URL: alchemy.secret.env.DATABASE_URL!,
    GOOGLE_GENERATIVE_AI_API_KEY:
      alchemy.secret.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    VITE_SERVER_URL: alchemy.env.VITE_SERVER_URL!,
  },
  cwd: "../../apps/website",
  name: "soundkit-web",
  wrangler: {
    transform: (spec) => ({
      ...spec,
      observability: {
        enabled: true,
        head_sampling_rate: 1,
        logs: {
          enabled: true,
          head_sampling_rate: 1,
          persist: true,
          invocation_logs: true,
        },
        traces: {
          enabled: true,
          persist: true,
          head_sampling_rate: 1,
        },
      },
    }),
  },
});

export const server = await Worker("server", {
  adopt: true,
  bindings: {
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    DATABASE_URL: alchemy.secret.env.DATABASE_URL!,
    GOOGLE_GENERATIVE_AI_API_KEY:
      alchemy.secret.env.GOOGLE_GENERATIVE_AI_API_KEY!,
  },
  compatibility: "node",
  cwd: "../../apps/server",
  dev: {
    port: 3000,
  },
  entrypoint: "src/index.ts",
  name: "soundkit-server",
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
