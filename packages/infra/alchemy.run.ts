import alchemy from "alchemy";
import {
  DurableObjectNamespace,
  Hyperdrive,
  R2Bucket,
  TanStackStart,
  Worker,
  Workflow,
} from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/website/.env" });
config({ path: "../../apps/server/.env" });

const app = await alchemy("soundkit", {
  stateStore: process.env.ALCHEMY_STATE_TOKEN
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
});
const isProduction = app.stage === "prod";
const isPullRequestPreview = app.stage.startsWith("pr-");

if (!(app.local || isProduction || isPullRequestPreview)) {
  throw new Error(
    `Unsupported remote stage "${app.stage}". Use prod or a pr-<number> preview stage.`
  );
}

const SITE_HOST = isProduction
  ? "mysoundkit.com"
  : `web-${app.stage}.mysoundkit.com`;
const API_HOST = isProduction
  ? "api.mysoundkit.com"
  : `api-${app.stage}.mysoundkit.com`;
const MEDIA_HOST = isProduction
  ? "media.mysoundkit.com"
  : `media-${app.stage}.mysoundkit.com`;
const SITE_URL = app.local ? "http://localhost:3001" : `https://${SITE_HOST}`;
const API_URL = app.local ? "http://localhost:3000" : `https://${API_HOST}`;
const MEDIA_URL = app.local ? API_URL : `https://${MEDIA_HOST}`;
const SENTRY_WEB_DSN =
  process.env.VITE_SENTRY_DSN ||
  "https://87f5517c906a37ab831c171fc686145d@o4510278858309632.ingest.us.sentry.io/4511447930568704";
const SENTRY_SERVER_DSN =
  process.env.SENTRY_DSN ||
  "https://13f74e858c970e20c62795b915266237@o4510278858309632.ingest.us.sentry.io/4511447939678208";
const resourceName = (name: string) =>
  isProduction ? name : `${name}-${app.stage}`;

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

const optionalEnvBinding = (name: string) => {
  const value = process.env[name];

  return value ? { [name]: value } : {};
};

const media = await R2Bucket("media", {
  adopt: isProduction,
  cors: [
    {
      allowed: {
        headers: ["*"],
        methods: ["GET", "HEAD", "PUT", "POST"],
        origins: [SITE_URL, API_URL],
      },
    },
  ],
  domains: app.local
    ? undefined
    : [{ adopt: isProduction, domain: MEDIA_HOST }],
  name: resourceName("soundkit-media"),
});

const trackProcessingWorkflow = Workflow("track-processing", {
  className: "TrackProcessingWorkflow",
  workflowName: resourceName("soundkit-track-processing"),
});

const liveRooms = DurableObjectNamespace("live-rooms", {
  className: "LiveRoomDurableObject",
  sqlite: true,
});

const hyperdrive = await Hyperdrive("hyperdrive", {
  ...(isProduction
    ? {
        adopt: true,
        hyperdriveId: "1b900b19692a4e9f920eebd379d21d3d",
      }
    : {
        name: resourceName("soundkit-hyperdrive"),
      }),
  origin: requiredSecret(alchemy.secret.env.DATABASE_URL, "DATABASE_URL"),
});

export const web = await TanStackStart("web", {
  adopt: isProduction,
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
    ...optionalEnvBinding("VITE_RADAR_PUBLISHABLE_KEY"),
    SENTRY_DSN: SENTRY_WEB_DSN,
    VITE_SENTRY_DSN: SENTRY_WEB_DSN,
    VITE_SERVER_URL: API_URL,
  },
  cwd: "../../apps/website",
  domains: app.local
    ? undefined
    : [{ adopt: isProduction, domainName: SITE_HOST }],
  name: resourceName("soundkit-web"),
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
  adopt: isProduction,
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
    LIVE_ROOMS: liveRooms,
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
    ...optionalEnvBinding("STRIPE_ARTIST_LITE_ANNUAL_PRICE_ID"),
    ...optionalEnvBinding("STRIPE_ARTIST_LITE_MONTHLY_PRICE_ID"),
    ...optionalEnvBinding("STRIPE_ARTIST_TEAM_ANNUAL_PRICE_ID"),
    ...optionalEnvBinding("STRIPE_ARTIST_TEAM_MONTHLY_PRICE_ID"),
    ...optionalEnvBinding("STRIPE_FAN_FAMILY_ANNUAL_PRICE_ID"),
    ...optionalEnvBinding("STRIPE_FAN_FAMILY_MONTHLY_PRICE_ID"),
    ...optionalEnvBinding("STRIPE_FAN_LITE_ANNUAL_PRICE_ID"),
    ...optionalEnvBinding("STRIPE_FAN_LITE_MONTHLY_PRICE_ID"),
    SENTRY_DSN: SENTRY_SERVER_DSN,
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
  domains: app.local
    ? undefined
    : [{ adopt: isProduction, domainName: API_HOST }],
  entrypoint: "src/index.ts",
  name: resourceName("soundkit-server"),
  placement: {
    region: "aws:us-east-1",
  },
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
