/* oxlint-disable node/no-top-level-await, one-var, sort-keys, sort-vars */
import alchemy from "alchemy";
import {
  AccountId,
  AccountApiToken,
  AnalyticsEngineDataset,
  Container,
  DurableObjectNamespace,
  Hyperdrive,
  Queue,
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
      ? (scope) =>
          new CloudflareStateStore(scope, {
            forceUpdate: process.env.ALCHEMY_STATE_FORCE_UPDATE === "true",
            scriptName: scope.stage.startsWith("pr-")
              ? `alchemy-state-service-${scope.stage}`
              : undefined,
          })
      : undefined,
  }),
  isProduction = app.stage === "prod",
  isPullRequestPreview = app.stage.startsWith("pr-");

if (!(app.local || isProduction || isPullRequestPreview)) {
  throw new Error(
    `Unsupported remote stage "${app.stage}". Use prod or a pr-<number> preview stage.`
  );
}

// Production serves media through the dedicated media host attached to the
// server Worker. Local and pr-<number> preview stages have no adopted media
// domain, so they route through the guarded /media API route instead.
const SITE_HOST = isProduction
    ? "mysoundkit.com"
    : `web-${app.stage}.mysoundkit.com`,
  API_HOST = isProduction
    ? "api.mysoundkit.com"
    : `api-${app.stage}.mysoundkit.com`,
  MEDIA_HOST = isProduction
    ? "media.mysoundkit.com"
    : `media-${app.stage}.mysoundkit.com`,
  SITE_URL = app.local ? "http://localhost:3001" : `https://${SITE_HOST}`,
  BIO_HOST = isProduction
    ? "bio.mysoundkit.com"
    : `bio-${app.stage}.mysoundkit.com`,
  BIO_URL = app.local
    ? "http://localhost:3002"
    : process.env.SOUNDKIT_BIO_URL || `https://${BIO_HOST}`,
  API_URL = app.local ? "http://localhost:3000" : `https://${API_HOST}`,
  MEDIA_URL = isProduction ? `https://${MEDIA_HOST}/media` : `${API_URL}/media`,
  SENTRY_WEB_DSN =
    process.env.VITE_SENTRY_DSN ||
    "https://87f5517c906a37ab831c171fc686145d@o4510278858309632.ingest.us.sentry.io/4511447930568704",
  SENTRY_SERVER_DSN =
    process.env.SENTRY_DSN ||
    "https://13f74e858c970e20c62795b915266237@o4510278858309632.ingest.us.sentry.io/4511447939678208",
  SENTRY_ENVIRONMENT = (() => {
    if (app.local) {
      return "development";
    }

    if (isProduction) {
      return "production";
    }

    return app.stage;
  })(),
  resourceName = (name: string) =>
    isProduction ? name : `${name}-${app.stage}`,
  shouldAdoptRemoteResources = isProduction || isPullRequestPreview,
  requiredSecret = <T>(value: T | undefined, name: string) => {
    if (!value) {
      throw new Error(`${name} is required.`);
    }

    return value;
  },
  requiredEnv = (name: string) => {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} is required.`);
    }

    return value;
  },
  optionalEnvBinding = (name: string) => {
    const value = process.env[name];

    return value ? { [name]: value } : {};
  },
  cloudflareAccountId = await AccountId(),
  getR2Jurisdiction = () => {
    const jurisdiction = process.env.CLOUDFLARE_R2_JURISDICTION;

    if (!jurisdiction || jurisdiction === "default") {
      return;
    }

    if (!["eu", "fedramp"].includes(jurisdiction)) {
      throw new Error(
        "CLOUDFLARE_R2_JURISDICTION must be default, eu, or fedramp."
      );
    }

    return jurisdiction as "eu" | "fedramp";
  },
  r2Jurisdiction = getR2Jurisdiction(),
  // Every stage (production and pr-<number> previews alike) shares the single
  // production media bucket, mirroring how stages share one application
  // database. Previews must never delete or empty it, so `delete` is only
  // enabled for production and the CORS rule is a stable wildcard so stage
  // deploys never fight over bucket configuration.
  MEDIA_BUCKET_NAME = "soundkit-media",
  media = await R2Bucket("media", {
    adopt: shouldAdoptRemoteResources,
    cors: [
      {
        allowed: {
          headers: ["*"],
          methods: ["GET", "HEAD", "PUT", "POST"],
          origins: [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://*.mysoundkit.com",
            "https://mysoundkit.com",
          ],
        },
        // @better-upload multipart uploads read the ETag response header from
        // the part PUT to build the CompleteMultipartUpload request, so it must
        // be exposed to the browser across origins.
        exposeHeaders: ["ETag"],
      },
    ],
    delete: isProduction,
    jurisdiction: r2Jurisdiction,
    name: MEDIA_BUCKET_NAME,
  }),
  mediaUploadToken = await AccountApiToken("media-upload-token", {
    name: resourceName("soundkit-media-upload-token"),
    policies: [
      {
        effect: "allow",
        permissionGroups: [
          "Workers R2 Storage Bucket Item Read",
          "Workers R2 Storage Bucket Item Write",
        ],
        resources: {
          [`com.cloudflare.edge.r2.bucket.${cloudflareAccountId}_${r2Jurisdiction ?? "default"}_${media.name}`]:
            "*",
        },
      },
    ],
  }),
  // Storage bucket for RealtimeKit live recordings. Recordings stay private
  // until a live experience is published; the server streams them via R2.
  recordings = await R2Bucket("recordings", {
    adopt: shouldAdoptRemoteResources,
    name: resourceName("soundkit-recordings"),
  }),
  recordingsUploadToken = await AccountApiToken("recordings-upload-token", {
    name: resourceName("soundkit-recordings-upload-token"),
    policies: [
      {
        effect: "allow",
        permissionGroups: [
          "Workers R2 Storage Bucket Item Read",
          "Workers R2 Storage Bucket Item Write",
        ],
        resources: {
          [`com.cloudflare.edge.r2.bucket.${cloudflareAccountId}_${r2Jurisdiction ?? "default"}_${recordings.name}`]:
            "*",
        },
      },
    ],
  }),
  liveRecordingWorkflow = Workflow("live-recording", {
    className: "LiveRecordingWorkflow",
    workflowName: resourceName("soundkit-live-recording"),
  }),
  trackEnrichmentWorkflow = Workflow("track-enrichment", {
    className: "TrackEnrichmentWorkflow",
    workflowName: resourceName("soundkit-track-enrichment"),
  }),
  mediaProcessingWorkflow = Workflow("media-processing", {
    className: "MediaProcessingWorkflow",
    workflowName: resourceName("soundkit-media-processing"),
  }),
  projectExportWorkflow = Workflow("project-export", {
    className: "ProjectExportWorkflow",
    workflowName: resourceName("soundkit-project-export"),
  }),
  mediaRetentionWorkflow = Workflow("media-retention", {
    className: "MediaRetentionWorkflow",
    workflowName: resourceName("soundkit-media-retention"),
  }),
  purchaseFulfillmentWorkflow = Workflow("purchase-fulfillment", {
    className: "PurchaseFulfillmentWorkflow",
    workflowName: resourceName("soundkit-purchase-fulfillment"),
  }),
  payoutRunWorkflow = Workflow("payout-run", {
    className: "PayoutRunWorkflow",
    workflowName: resourceName("soundkit-payout-run"),
  }),
  mediaProcessor = await Container("media-processor", {
    adopt: shouldAdoptRemoteResources,
    build: {
      context: "../../apps/media-processor",
      dockerfile: "Dockerfile",
      platform: "linux/amd64",
    },
    className: "MediaProcessorContainer",
    instanceType: isProduction ? "standard-1" : "basic",
    maxInstances: isProduction ? 25 : 20,
    name: resourceName("soundkit-media-processor"),
    observability: {
      logs: { enabled: true },
    },
  }),
  emailDeliveryDeadLetterQueue = await Queue("email-delivery-dlq", {
    adopt: shouldAdoptRemoteResources,
    name: resourceName("soundkit-email-delivery-dlq"),
    settings: {
      messageRetentionPeriod: 1_209_600,
    },
  }),
  emailDeliveryQueue = await Queue("email-delivery", {
    adopt: shouldAdoptRemoteResources,
    dlq: emailDeliveryDeadLetterQueue,
    name: resourceName("soundkit-email-delivery"),
    settings: {
      messageRetentionPeriod: 1_209_600,
    },
  }),
  liveNotificationDeadLetterQueue = await Queue("live-notifications-dlq", {
    adopt: shouldAdoptRemoteResources,
    name: resourceName("soundkit-live-notifications-dlq"),
    settings: {
      messageRetentionPeriod: 1_209_600,
    },
  }),
  liveNotificationQueue = await Queue("live-notifications", {
    adopt: shouldAdoptRemoteResources,
    dlq: liveNotificationDeadLetterQueue,
    name: resourceName("soundkit-live-notifications"),
    settings: {
      messageRetentionPeriod: 1_209_600,
    },
  }),
  activityNotificationDeadLetterQueue = await Queue(
    "activity-notifications-dlq",
    {
      adopt: shouldAdoptRemoteResources,
      name: resourceName("soundkit-activity-notifications-dlq"),
      settings: {
        messageRetentionPeriod: 1_209_600,
      },
    }
  ),
  activityNotificationQueue = await Queue("activity-notifications", {
    adopt: shouldAdoptRemoteResources,
    dlq: activityNotificationDeadLetterQueue,
    name: resourceName("soundkit-activity-notifications"),
    settings: {
      messageRetentionPeriod: 1_209_600,
    },
  }),
  battleDirectory = DurableObjectNamespace("battle-directory", {
    className: "BattleDirectoryDurableObject",
    sqlite: true,
  }),
  liveRooms = DurableObjectNamespace("live-rooms", {
    className: "LiveRoomDurableObject",
    sqlite: true,
  }),
  presence = DurableObjectNamespace("presence", {
    className: "PresenceDurableObject",
    sqlite: true,
  }),
  doMetrics = AnalyticsEngineDataset("do-metrics", {
    dataset: resourceName("soundkit_do_metrics"),
  }),
  trackDurationBackfillDeadLetterQueue = await Queue(
    "track-duration-backfill-dlq",
    {
      adopt: shouldAdoptRemoteResources,
      name: resourceName("soundkit-track-duration-backfill-dlq"),
      settings: {
        messageRetentionPeriod: 1_209_600,
      },
    }
  ),
  trackDurationBackfillQueue = await Queue("track-duration-backfill", {
    adopt: shouldAdoptRemoteResources,
    dlq: trackDurationBackfillDeadLetterQueue,
    name: resourceName("soundkit-track-duration-backfill"),
    settings: {
      messageRetentionPeriod: 1_209_600,
    },
  }),
  hyperdrive = await Hyperdrive("hyperdrive", {
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
    SENTRY_DSN: SENTRY_WEB_DSN,
    VITE_ENABLE_MERCH: "false",
    VITE_SENTRY_ENVIRONMENT: SENTRY_ENVIRONMENT,
    VITE_MEDIA_URL: MEDIA_URL,
    ...optionalEnvBinding("VITE_GOOGLE_MAPS_API_KEY"),
    ...optionalEnvBinding("VITE_STRIPE_PUBLISHABLE_KEY"),
    ...optionalEnvBinding("VITE_TURNSTILE_SITE_KEY"),
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

export const bio = await TanStackStart("bio", {
  adopt: isProduction,
  bindings: {
    VITE_SERVER_URL: API_URL,
    VITE_SOUNDKIT_BIO_URL: BIO_URL,
    VITE_SOUNDKIT_WEB_URL: SITE_URL,
    ...optionalEnvBinding("VITE_STRIPE_PUBLISHABLE_KEY"),
  },
  cwd: "../../apps/bio",
  domains: app.local
    ? undefined
    : [{ adopt: isProduction, domainName: BIO_HOST }],
  name: resourceName("soundkit-bio"),
});

export const server = await Worker("server", {
  adopt: isProduction,
  bindings: {
    BETTER_AUTH_SECRET: requiredSecret(
      alchemy.secret.env.BETTER_AUTH_SECRET,
      "BETTER_AUTH_SECRET"
    ),
    BETTER_AUTH_URL: API_URL,
    CLOUDFLARE_ACCESS_KEY_ID: mediaUploadToken.accessKeyId,
    CLOUDFLARE_ACCOUNT_ID: cloudflareAccountId,
    CLOUDFLARE_SECRET_ACCESS_KEY: mediaUploadToken.secretAccessKey,
    CORS_ORIGIN: SITE_URL,
    ...optionalEnvBinding("CLOUDFLARE_API_TOKEN"),
    ...optionalEnvBinding("CLOUDFLARE_REALTIMEKIT_APP_ID"),
    ...optionalEnvBinding("CLOUDFLARE_STREAM_API_TOKEN"),
    ...optionalEnvBinding("CLOUDFLARE_STREAM_CUSTOMER_CODE"),
    ...optionalEnvBinding("CLOUDFLARE_STREAM_WEBHOOK_SECRET"),
    SOUNDKIT_ALLOW_MOCK_REALTIME: isPullRequestPreview ? "true" : "false",
    DATABASE_URL: requiredSecret(
      alchemy.secret.env.DATABASE_URL,
      "DATABASE_URL"
    ),
    BATTLE_DIRECTORY: battleDirectory,
    DO_METRICS: doMetrics,
    EMAIL_DELIVERY_QUEUE: emailDeliveryQueue,
    GOOGLE_EMBEDDING_MODEL: requiredEnv("GOOGLE_EMBEDDING_MODEL"),
    GOOGLE_GENERATIVE_AI_API_KEY: requiredSecret(
      alchemy.secret.env.GOOGLE_GENERATIVE_AI_API_KEY,
      "GOOGLE_GENERATIVE_AI_API_KEY"
    ),
    HYPERDRIVE: hyperdrive,
    LIVE_NOTIFICATION_QUEUE: liveNotificationQueue,
    NOTIFICATION_QUEUE: activityNotificationQueue,
    LIVE_RECORDING_WORKFLOW: liveRecordingWorkflow,
    LIVE_ROOMS: liveRooms,
    PRESENCE: presence,
    PROJECT_EXPORT_WORKFLOW: projectExportWorkflow,
    MEDIA_BUCKET: media,
    MEDIA_CANONICAL_URL: MEDIA_URL,
    MEDIA_PROCESSING_WORKFLOW: mediaProcessingWorkflow,
    MEDIA_PROCESSOR: mediaProcessor,
    MEDIA_RETENTION_WORKFLOW: mediaRetentionWorkflow,
    PURCHASE_FULFILLMENT_WORKFLOW: purchaseFulfillmentWorkflow,
    PAYOUT_RUN_WORKFLOW: payoutRunWorkflow,
    MEDIA_PUBLIC_URL: MEDIA_URL,
    RECORDINGS_ACCESS_KEY_ID: recordingsUploadToken.accessKeyId,
    RECORDINGS_BUCKET: recordings,
    RECORDINGS_BUCKET_NAME: recordings.name,
    RECORDINGS_SECRET_ACCESS_KEY: recordingsUploadToken.secretAccessKey,
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
    OPENAI_API_KEY: requiredSecret(
      alchemy.secret.env.OPENAI_API_KEY,
      "OPENAI_API_KEY"
    ),
    SOUNDKIT_PUBLIC_URL: SITE_URL,
    SOUNDKIT_BIO_URL: BIO_URL,
    ...optionalEnvBinding("RESEND_API_KEY"),
    ...optionalEnvBinding("RESEND_WEBHOOK_SECRET"),
    ...optionalEnvBinding("TURNSTILE_HOSTNAMES"),
    ...optionalEnvBinding("TURNSTILE_SECRET"),
    ...optionalEnvBinding("SOUNDKIT_EMAIL_FROM"),
    ...optionalEnvBinding("SOUNDKIT_EMAIL_REPLY_TO"),
    SENTRY_DSN: SENTRY_SERVER_DSN,
    SENTRY_ENVIRONMENT,
    STEMSPLIT_API_KEY: requiredSecret(
      alchemy.secret.env.STEMSPLIT_API_KEY,
      "STEMSPLIT_API_KEY"
    ),
    STEMSPLIT_WEBHOOK_SECRET: requiredSecret(
      alchemy.secret.env.STEMSPLIT_WEBHOOK_SECRET,
      "STEMSPLIT_WEBHOOK_SECRET"
    ),
    STRIPE_SECRET_KEY: requiredSecret(
      alchemy.secret.env.STRIPE_SECRET_KEY,
      "STRIPE_SECRET_KEY"
    ),
    ...optionalEnvBinding("STRIPE_BETTER_AUTH_WEBHOOK_SECRET"),
    ...optionalEnvBinding("STRIPE_COMMERCE_WEBHOOK_SECRET"),
    ...optionalEnvBinding("STRIPE_CONNECT_WEBHOOK_SECRET"),
    TRACK_ENRICHMENT_WORKFLOW: trackEnrichmentWorkflow,
    TRACK_DURATION_BACKFILL_QUEUE: trackDurationBackfillQueue,
    UPLOAD_BUCKET_NAME: media.name,
    ...optionalEnvBinding("ADMIN_EMAILS"),
    ...optionalEnvBinding("BATTLE_ADMISSION_BATCH_SIZE"),
    ...optionalEnvBinding("GOOGLE_CLIENT_ID"),
    ...optionalEnvBinding("GOOGLE_CLIENT_SECRET"),
    ...(r2Jurisdiction ? { CLOUDFLARE_R2_JURISDICTION: r2Jurisdiction } : {}),
    ...optionalEnvBinding("STRIPE_SOUNDKIT_PREMIUM_ARTIST_ANNUAL_PRICE_ID"),
    ...optionalEnvBinding("STRIPE_SOUNDKIT_PREMIUM_ARTIST_MONTHLY_PRICE_ID"),
    ...optionalEnvBinding("STRIPE_SOUNDKIT_PREMIUM_FAN_ANNUAL_PRICE_ID"),
    ...optionalEnvBinding("STRIPE_SOUNDKIT_PREMIUM_FAN_MONTHLY_PRICE_ID"),
  },
  compatibility: "node",
  crons: ["*/5 * * * *"],
  cwd: "../../apps/server",
  dev: {
    port: 3000,
  },
  domains: app.local
    ? undefined
    : [
        { adopt: isProduction, domainName: API_HOST },
        { adopt: isProduction, domainName: MEDIA_HOST },
      ],
  entrypoint: "src/index.ts",
  eventSources: [
    {
      queue: emailDeliveryQueue,
      settings: {
        batchSize: 10,
        deadLetterQueue: emailDeliveryDeadLetterQueue,
        maxConcurrency: 5,
        maxRetries: 6,
        maxWaitTimeMs: 2500,
        retryDelay: 60,
      },
    },
    {
      queue: liveNotificationQueue,
      settings: {
        batchSize: 50,
        deadLetterQueue: liveNotificationDeadLetterQueue,
        maxConcurrency: 10,
        maxRetries: 6,
        maxWaitTimeMs: 5000,
        retryDelay: 30,
      },
    },
    {
      queue: activityNotificationQueue,
      settings: {
        batchSize: 25,
        deadLetterQueue: activityNotificationDeadLetterQueue,
        maxConcurrency: 10,
        maxRetries: 6,
        maxWaitTimeMs: 2500,
        retryDelay: 30,
      },
    },
    {
      queue: trackDurationBackfillQueue,
      settings: {
        batchSize: 10,
        deadLetterQueue: trackDurationBackfillDeadLetterQueue,
        maxConcurrency: 5,
        maxRetries: 5,
        maxWaitTimeMs: 2500,
        retryDelay: 30,
      },
    },
  ],
  name: resourceName("soundkit-server"),
  observability: {
    enabled: true,
    headSamplingRate: 1,
    logs: {
      enabled: true,
      headSamplingRate: 1,
      invocationLogs: true,
      persist: true,
    },
    traces: {
      enabled: true,
      headSamplingRate: 1,
      persist: true,
    },
  },
  placement: {
    region: "aws:us-east-1",
  },
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
