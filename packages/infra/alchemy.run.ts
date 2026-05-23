import alchemy from "alchemy";
import {
  Hyperdrive,
  R2Bucket,
  TanStackStart,
  Worker,
  Workflow,
} from "alchemy/cloudflare";
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

const requiredEnv = (name: string) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
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

const hyperdrive = await Hyperdrive("hyperdrive", {
  adopt: true,
  hyperdriveId: "02fa325c571741aca9b6acbec0b40546",
  origin: requiredSecret(alchemy.secret.env.DATABASE_URL, "DATABASE_URL"),
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
    GOOGLE_EMBEDDING_MODEL: requiredEnv("GOOGLE_EMBEDDING_MODEL"),
    GOOGLE_GENERATIVE_AI_API_KEY: requiredSecret(
      alchemy.secret.env.GOOGLE_GENERATIVE_AI_API_KEY,
      "GOOGLE_GENERATIVE_AI_API_KEY"
    ),
    HYPERDRIVE: hyperdrive,
    MEDIA_BUCKET: media,
    MEDIA_PUBLIC_URL: MEDIA_URL,
    MUX_TOKEN_ID: requiredSecret(
      alchemy.secret.env.MUX_TOKEN_ID,
      "MUX_TOKEN_ID"
    ),
    MUX_TOKEN_SECRET: requiredSecret(
      alchemy.secret.env.MUX_TOKEN_SECRET,
      "MUX_TOKEN_SECRET"
    ),
    MUX_WEBHOOK_SECRET: requiredSecret(
      alchemy.secret.env.MUX_WEBHOOK_SECRET,
      "MUX_WEBHOOK_SECRET"
    ),
    STEMSPLIT_API_KEY: requiredSecret(
      alchemy.secret.env.STEMSPLIT_API_KEY,
      "STEMSPLIT_API_KEY"
    ),
    STEMSPLIT_WEBHOOK_SECRET: requiredSecret(
      alchemy.secret.env.STEMSPLIT_WEBHOOK_SECRET,
      "STEMSPLIT_WEBHOOK_SECRET"
    ),
    STRIPE_ARTIST_LITE_ANNUAL_PRICE_ID:
      process.env.STRIPE_ARTIST_LITE_ANNUAL_PRICE_ID,
    STRIPE_ARTIST_LITE_MONTHLY_PRICE_ID:
      process.env.STRIPE_ARTIST_LITE_MONTHLY_PRICE_ID,
    STRIPE_ARTIST_TEAM_ANNUAL_PRICE_ID:
      process.env.STRIPE_ARTIST_TEAM_ANNUAL_PRICE_ID,
    STRIPE_ARTIST_TEAM_MONTHLY_PRICE_ID:
      process.env.STRIPE_ARTIST_TEAM_MONTHLY_PRICE_ID,
    STRIPE_FAN_FAMILY_ANNUAL_PRICE_ID:
      process.env.STRIPE_FAN_FAMILY_ANNUAL_PRICE_ID,
    STRIPE_FAN_FAMILY_MONTHLY_PRICE_ID:
      process.env.STRIPE_FAN_FAMILY_MONTHLY_PRICE_ID,
    STRIPE_FAN_LITE_ANNUAL_PRICE_ID:
      process.env.STRIPE_FAN_LITE_ANNUAL_PRICE_ID,
    STRIPE_FAN_LITE_MONTHLY_PRICE_ID:
      process.env.STRIPE_FAN_LITE_MONTHLY_PRICE_ID,
    STRIPE_SECRET_KEY: requiredSecret(
      alchemy.secret.env.STRIPE_SECRET_KEY,
      "STRIPE_SECRET_KEY"
    ),
    STRIPE_WEBHOOK_SECRET: requiredSecret(
      alchemy.secret.env.STRIPE_WEBHOOK_SECRET,
      "STRIPE_WEBHOOK_SECRET"
    ),
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
  placement: {
    region: "aws:us-east-1",
  },
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
