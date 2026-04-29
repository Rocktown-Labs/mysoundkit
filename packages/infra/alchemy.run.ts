import alchemy from "alchemy";
import { R2Bucket, TanStackStart, Worker, Workflow } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/website/.env" });
config({ path: "../../apps/server/.env" });

const app = await alchemy("soundkit");
const SITE_URL = "https://mysoundkit.com";
const API_URL = "https://api.mysoundkit.com";
const MEDIA_URL = "https://media.mysoundkit.com";

const requiredSecret = <T>(value: T | undefined, name: string) => {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const optionalSecretBinding = (name: string) => {
  const value = process.env[name];

  return value ? { [name]: alchemy.secret(value, name) } : {};
};

const media = await R2Bucket("media", {
  adopt: true,
  cors: [
    {
      allowed: {
        headers: ["*"],
        methods: ["GET", "HEAD", "PUT", "POST"],
        origins: [SITE_URL, API_URL],
      },
    },
  ],
  domains: [{ adopt: true, domain: "media.mysoundkit.com" }],
  name: "soundkit-media",
});

const trackProcessingWorkflow = Workflow("track-processing", {
  className: "TrackProcessingWorkflow",
  workflowName: "soundkit-track-processing",
});

export const web = await TanStackStart("web", {
  adopt: true,
  bindings: {
    BETTER_AUTH_SECRET: requiredSecret(
      alchemy.secret.env.BETTER_AUTH_SECRET,
      "BETTER_AUTH_SECRET"
    ),
    BETTER_AUTH_URL: API_URL,
    CORS_ORIGIN: SITE_URL,
    DATABASE_URL: requiredSecret(
      alchemy.secret.env.DATABASE_URL,
      "DATABASE_URL"
    ),
    ...optionalSecretBinding("GOOGLE_GENERATIVE_AI_API_KEY"),
    VITE_MEDIA_URL: MEDIA_URL,
    VITE_SERVER_URL: API_URL,
  },
  cwd: "../../apps/website",
  domains: [{ adopt: true, domainName: "mysoundkit.com" }],
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
          invocation_logs: true,
          persist: true,
        },
        traces: {
          enabled: true,
          head_sampling_rate: 1,
          persist: true,
        },
      },
    }),
  },
});

export const server = await Worker("server", {
  adopt: true,
  bindings: {
    BETTER_AUTH_SECRET: requiredSecret(
      alchemy.secret.env.BETTER_AUTH_SECRET,
      "BETTER_AUTH_SECRET"
    ),
    BETTER_AUTH_URL: API_URL,
    CORS_ORIGIN: SITE_URL,
    DATABASE_URL: requiredSecret(
      alchemy.secret.env.DATABASE_URL,
      "DATABASE_URL"
    ),
    GOOGLE_GENERATIVE_AI_API_KEY: requiredSecret(
      alchemy.secret.env.GOOGLE_GENERATIVE_AI_API_KEY,
      "GOOGLE_GENERATIVE_AI_API_KEY"
    ),
    MEDIA_BUCKET: media,
    MEDIA_PUBLIC_URL: MEDIA_URL,
    ...optionalSecretBinding("GOOGLE_GENERATIVE_AI_API_KEY"),
    ...optionalSecretBinding("GOOGLE_EMBEDDING_MODEL"),
    ...optionalSecretBinding("MUX_TOKEN_ID"),
    ...optionalSecretBinding("MUX_TOKEN_SECRET"),
    ...optionalSecretBinding("MUX_WEBHOOK_SECRET"),
    ...optionalSecretBinding("STEMSPLIT_API_KEY"),
    ...optionalSecretBinding("STEMSPLIT_WEBHOOK_SECRET"),
    ...optionalSecretBinding("STRIPE_SECRET_KEY"),
    ...optionalSecretBinding("STRIPE_WEBHOOK_SECRET"),
    TRACK_PROCESSING_WORKFLOW: trackProcessingWorkflow,
    UPLOAD_BUCKET_NAME: media.name,
  },
  compatibility: "node",
  cwd: "../../apps/server",
  dev: {
    port: 3000,
  },
  domains: [{ adopt: true, domainName: "api.mysoundkit.com" }],
  entrypoint: "src/index.ts",
  name: "soundkit-server",
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
