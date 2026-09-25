/* oxlint-disable node/no-top-level-await, one-var, sort-keys, sort-vars, func-names, max-classes-per-file */
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Stage } from "alchemy/Stage";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/website/.env" });
config({ path: "../../apps/server/.env" });

// `alchemy dev` sets ALCHEMY_DEV=true on the spawned process; every other
// entrypoint leaves it unset. Read via process.env (not Config) so this
// stays infallible and usable inside props Effects.
const isLocalDev = ["true", "1", "yes", "on"].includes(
  (process.env.ALCHEMY_DEV ?? "").toLowerCase()
);

// Shared deployment-time configuration. Evaluated lazily inside resource
// props (never at import time, so `alchemy profile edit` can still import
// this file to discover providers).
const deployment = Effect.gen(function* () {
  const stage = yield* Stage,
    isProduction = stage === "prod",
    isPullRequestPreview = stage.startsWith("pr-");

  if (!(isLocalDev || isProduction || isPullRequestPreview)) {
    throw new Error(
      `Unsupported remote stage "${stage}". Use prod or a pr-<number> preview stage.`
    );
  }

  // Production serves media through the dedicated media host attached to the
  // server Worker. Local and pr-<number> preview stages have no adopted media
  // domain, so they route through the guarded /media API route instead.
  const SITE_HOST = isProduction
      ? "mysoundkit.com"
      : `soundkit-web-${stage}.mysoundkit.com`,
    API_HOST = isProduction
      ? "api.mysoundkit.com"
      : `api-${stage}.mysoundkit.com`,
    MEDIA_HOST = isProduction
      ? "media.mysoundkit.com"
      : `media-${stage}.mysoundkit.com`,
    SITE_URL = isLocalDev ? "http://localhost:3001" : `https://${SITE_HOST}`,
    BIO_HOST = isProduction ? "soundkit.bio" : `bio-${stage}.mysoundkit.com`,
    BIO_ALIAS_HOSTS = ["www.soundkit.bio"],
    BIO_URL = (() => {
      if (isLocalDev) {
        return "http://localhost:3002";
      }
      if (isProduction) {
        return `https://${BIO_HOST}`;
      }
      return process.env.SOUNDKIT_BIO_URL || `https://${BIO_HOST}`;
    })(),
    API_URL = isLocalDev ? "http://localhost:3000" : `https://${API_HOST}`,
    MEDIA_URL = isProduction ? `https://${MEDIA_HOST}/media` : `${API_URL}/media`,
    SENTRY_WEB_DSN =
      process.env.VITE_SENTRY_DSN ||
      "https://87f5517c906a37ab831c171fc686145d@o4510278858309632.ingest.us.sentry.io/4511447930568704",
    SENTRY_SERVER_DSN =
      process.env.SENTRY_DSN ||
      "https://13f54e858c970e20c62795b915266237@o4510278858309632.ingest.us.sentry.io/4511447939678208",
    SENTRY_ENVIRONMENT = (() => {
      if (isLocalDev) {
        return "development";
      }

      if (isProduction) {
        return "production";
      }

      return stage;
    })(),
    resourceName = (name: string) =>
      isProduction ? name : `${name}-${stage}`;

  return {
    API_HOST,
    API_URL,
    BIO_ALIAS_HOSTS,
    BIO_HOST,
    BIO_URL,
    MEDIA_BUCKET_NAME: "soundkit-media",
    MEDIA_HOST,
    MEDIA_URL,
    SENTRY_ENVIRONMENT,
    SENTRY_SERVER_DSN,
    SENTRY_WEB_DSN,
    SITE_HOST,
    SITE_URL,
    isLocalDev,
    isProduction,
    isPullRequestPreview,
    resourceName,
    stage,
  };
});

const getR2Jurisdiction = () => {
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
  optionalEnvBinding = (name: string) => {
    const value = process.env[name];

    return value ? { [name]: value } : {};
  };

// Every stage (production and pr-<number> previews alike) shares the single
// production media bucket, mirroring how stages share one application
// database. Previews must never delete or empty it, so `forceDestroy` is
// only enabled for production and the CORS rule is a stable wildcard so
// stage deploys never fight over bucket configuration.
export const media = Cloudflare.R2.Bucket(
  "media",
  Effect.gen(function* () {
    const d = yield* deployment;

    return {
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: ["GET", "HEAD", "PUT", "POST"] as (
            | "GET"
            | "HEAD"
            | "PUT"
            | "POST"
          )[],
          allowedOrigins: [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://*.mysoundkit.com",
            "https://mysoundkit.com",
            "https://soundkit.bio",
            "https://www.soundkit.bio",
          ],
          // @better-upload multipart uploads read the ETag response header
          // from the part PUT to build the CompleteMultipartUpload request,
          // so it must be exposed to the browser across origins.
          exposeHeaders: ["ETag"],
        },
      ],
      forceDestroy: d.isProduction,
      ...(r2Jurisdiction ? { jurisdiction: r2Jurisdiction } : {}),
      name: d.MEDIA_BUCKET_NAME,
    };
  })
);

// Storage bucket for RealtimeKit live recordings. Recordings stay private
// until a live experience is published; the server streams them via R2.
export const recordings = Cloudflare.R2.Bucket(
  "recordings",
  Effect.gen(function* () {
    const d = yield* deployment;

    return {
      ...(r2Jurisdiction ? { jurisdiction: r2Jurisdiction } : {}),
      name: d.resourceName("soundkit-recordings"),
    };
  })
);

// NOTE (v2 migration): v1 managed the R2 S3 upload tokens as
// `AccountApiToken` resources. v2 account tokens do not expose S3
// accessKeyId/secretAccessKey pairs, so the pre-existing token pairs are
// managed outside Alchemy now. Create (or reuse) them once in the
// Cloudflare dashboard (R2 > API Tokens) and provide the values at deploy
// time via CLOUDFLARE_ACCESS_KEY_ID / CLOUDFLARE_SECRET_ACCESS_KEY and
// RECORDINGS_ACCESS_KEY_ID / RECORDINGS_SECRET_ACCESS_KEY. The old tokens
// stay valid until deleted, so rotation is zero-downtime.
const emailDeliveryDeadLetterQueue = Cloudflare.Queues.Queue(
    "email-delivery-dlq",
    Effect.gen(function* () {
      const d = yield* deployment;

      return {
        name: d.resourceName("soundkit-email-delivery-dlq"),
      };
    })
  ),
  emailDeliveryQueue = Cloudflare.Queues.Queue(
    "email-delivery",
    Effect.gen(function* () {
      const d = yield* deployment;

      return {
        name: d.resourceName("soundkit-email-delivery"),
      };
    })
  ),
  liveNotificationDeadLetterQueue = Cloudflare.Queues.Queue(
    "live-notifications-dlq",
    Effect.gen(function* () {
      const d = yield* deployment;

      return {
        name: d.resourceName("soundkit-live-notifications-dlq"),
      };
    })
  ),
  liveNotificationQueue = Cloudflare.Queues.Queue(
    "live-notifications",
    Effect.gen(function* () {
      const d = yield* deployment;

      return {
        name: d.resourceName("soundkit-live-notifications"),
      };
    })
  ),
  activityNotificationDeadLetterQueue = Cloudflare.Queues.Queue(
    "activity-notifications-dlq",
    Effect.gen(function* () {
      const d = yield* deployment;

      return {
        name: d.resourceName("soundkit-activity-notifications-dlq"),
      };
    })
  ),
  activityNotificationQueue = Cloudflare.Queues.Queue(
    "activity-notifications",
    Effect.gen(function* () {
      const d = yield* deployment;

      return {
        name: d.resourceName("soundkit-activity-notifications"),
      };
    })
  ),
  trackDurationBackfillDeadLetterQueue = Cloudflare.Queues.Queue(
    "track-duration-backfill-dlq",
    Effect.gen(function* () {
      const d = yield* deployment;

      return {
        name: d.resourceName("soundkit-track-duration-backfill-dlq"),
      };
    })
  ),
  trackDurationBackfillQueue = Cloudflare.Queues.Queue(
    "track-duration-backfill",
    Effect.gen(function* () {
      const d = yield* deployment;

      return {
        name: d.resourceName("soundkit-track-duration-backfill"),
      };
    })
  ),
  // NOTE (v2 migration): v1 derived Hyperdrive's physical name as
  // `soundkit-hyperdrive-prod` for production (the `{app}-{id}-{stage}`
  // default). v2 derives names differently, so the production name is
  // pinned explicitly here for adoption.
  hyperdrive = Cloudflare.Hyperdrive.Connection(
    "hyperdrive",
    Effect.gen(function* () {
      const d = yield* deployment,
        // Read synchronously (dotenv is loaded above): props Effects must
        // stay infallible, and a missing DATABASE_URL fails the deploy fast
        // exactly like v1's requiredSecret.
        rawDatabaseUrl = process.env.DATABASE_URL;

      if (!rawDatabaseUrl) {
        throw new Error("DATABASE_URL is required.");
      }

      const parsed = new URL(rawDatabaseUrl);

      return {
        name: d.isProduction
          ? "soundkit-hyperdrive-prod"
          : `soundkit-hyperdrive-${d.stage}`,
        origin: {
          database: decodeURIComponent(
            parsed.pathname.replace(/^\//u, "")
          ),
          host: parsed.hostname,
          ...(parsed.port ? { port: Number(parsed.port) } : {}),
          password: Redacted.make(decodeURIComponent(parsed.password)),
          scheme: parsed.protocol.replace(/:$/u, "") as
            | "postgres"
            | "postgresql"
            | "mysql",
          user: decodeURIComponent(parsed.username),
        },
      };
    })
  );

// NOTE (v2 migration): workflow physical names are derived by v2 as
// `{script}-{class}-{hash}`, so the first v2 deploy creates new workflow
// definitions alongside the v1 ones (`soundkit-*`). In-flight instances
// finish on the old definitions; new instances use the new ones. The
// orphaned v1 definitions can be removed from the Cloudflare dashboard
// once no instances remain.
const liveRecordingWorkflow = Cloudflare.Workflow("live-recording", {
    className: "LiveRecordingWorkflow",
  }),
  trackEnrichmentWorkflow = Cloudflare.Workflow("track-enrichment", {
    className: "TrackEnrichmentWorkflow",
  }),
  mediaProcessingWorkflow = Cloudflare.Workflow("media-processing", {
    className: "MediaProcessingWorkflow",
  }),
  projectExportWorkflow = Cloudflare.Workflow("project-export", {
    className: "ProjectExportWorkflow",
  }),
  mediaRetentionWorkflow = Cloudflare.Workflow("media-retention", {
    className: "MediaRetentionWorkflow",
  }),
  purchaseFulfillmentWorkflow = Cloudflare.Workflow("purchase-fulfillment", {
    className: "PurchaseFulfillmentWorkflow",
  }),
  payoutRunWorkflow = Cloudflare.Workflow("payout-run", {
    className: "PayoutRunWorkflow",
  });

export class MediaProcessorContainer extends Cloudflare.Container<MediaProcessorContainer>()(
  "media-processor",
  Effect.gen(function* () {
    const d = yield* deployment;

    return {
      className: "MediaProcessorContainer",
      context: "../../apps/media-processor",
      dockerfile: "Dockerfile",
      instanceType: d.isProduction ? "standard-1" : "basic",
      maxInstances: d.isProduction ? 25 : 20,
      name: d.resourceName("soundkit-media-processor"),
      observability: {
        logs: { enabled: true },
      },
    };
  })
) {}

export class StemSeparatorContainer extends Cloudflare.Container<StemSeparatorContainer>()(
  "stem-separator",
  Effect.gen(function* () {
    const d = yield* deployment;

    return {
      className: "StemSeparatorContainer",
      context: "../../apps/stem-separator",
      dockerfile: "Dockerfile",
      instanceType: "standard-3",
      maxInstances: 10,
      name: d.resourceName("soundkit-stem-separator"),
      observability: {
        logs: { enabled: true },
      },
    };
  })
) {}

const workersAi = Cloudflare.Workers.AI(),
  battleDirectory = Cloudflare.DurableObject("battle-directory", {
    className: "BattleDirectoryDurableObject",
  }),
  liveRooms = Cloudflare.DurableObject("live-rooms", {
    className: "LiveRoomDurableObject",
  }),
  presence = Cloudflare.DurableObject("presence", {
    className: "PresenceDurableObject",
  }),
  doMetrics = Effect.gen(function* () {
    const d = yield* deployment;

    return yield* Cloudflare.AnalyticsEngine.Dataset("do-metrics", {
      dataset: d.resourceName("soundkit_do_metrics"),
    });
  });

export const web = Cloudflare.Website.Vite(
  "web",
  Effect.gen(function* () {
    const d = yield* deployment;

    return {
      domain: d.isLocalDev ? undefined : { name: d.SITE_HOST },
      env: {
        BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
        BETTER_AUTH_URL: d.API_URL,
        CORS_ORIGIN: d.SITE_URL,
        DATABASE_URL: Config.Redacted("DATABASE_URL"),
        SENTRY_DSN: d.SENTRY_WEB_DSN,
        VITE_ENABLE_MERCH: "false",
        VITE_MEDIA_URL: d.MEDIA_URL,
        ...optionalEnvBinding("VITE_GOOGLE_MAPS_API_KEY"),
        ...optionalEnvBinding("VITE_STRIPE_PUBLISHABLE_KEY"),
        ...optionalEnvBinding("VITE_TURNSTILE_SITE_KEY"),
        VITE_SENTRY_DSN: d.SENTRY_WEB_DSN,
        VITE_SENTRY_ENVIRONMENT: d.SENTRY_ENVIRONMENT,
        VITE_SERVER_URL: d.API_URL,
      },
      name: d.resourceName("soundkit-web"),
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
      rootDir: "../../apps/website",
    };
  })
);

export type WebEnv = Cloudflare.InferEnv<typeof web>;

export const bio = Cloudflare.Website.Vite(
  "bio",
  Effect.gen(function* () {
    const d = yield* deployment;

    return {
      domain: d.isLocalDev
        ? undefined
        : {
            aliases: d.isProduction ? [...d.BIO_ALIAS_HOSTS] : undefined,
            name: d.BIO_HOST,
          },
      env: {
        VITE_SERVER_URL: d.API_URL,
        VITE_SOUNDKIT_BIO_URL: d.BIO_URL,
        VITE_SOUNDKIT_WEB_URL: d.SITE_URL,
        ...optionalEnvBinding("VITE_STRIPE_PUBLISHABLE_KEY"),
        ...optionalEnvBinding("VITE_TURNSTILE_SITE_KEY"),
      },
      name: d.resourceName("soundkit-bio"),
      rootDir: "../../apps/bio",
    };
  })
);

export type BioEnv = Cloudflare.InferEnv<typeof bio>;

export const server = Cloudflare.Worker(
  "server",
  Effect.gen(function* () {
    const d = yield* deployment;

    return {
      compatibility: { flags: ["nodejs_compat"] },
      // Scheduled jobs are production-only. Preview Workers share
      // production backing services, so registering this trigger would
      // create production side effects from an isolated preview deployment.
      crons: d.isProduction ? ["*/5 * * * *"] : [],
      dev: {
        port: 3000,
      },
      domain: d.isLocalDev
        ? undefined
        : { aliases: [d.MEDIA_HOST], name: d.API_HOST },
      env: {
        AI: workersAi,
        AUDIO_EMBEDDINGS_ENABLED: "true",
        BATTLE_DIRECTORY: battleDirectory,
        BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
        BETTER_AUTH_URL: d.API_URL,
        CLOUDFLARE_ACCESS_KEY_ID: Config.String("CLOUDFLARE_ACCESS_KEY_ID"),
        CLOUDFLARE_ACCOUNT_ID: Config.String("CLOUDFLARE_ACCOUNT_ID"),
        CLOUDFLARE_SECRET_ACCESS_KEY: Config.Redacted(
          "CLOUDFLARE_SECRET_ACCESS_KEY"
        ),
        CORS_ORIGIN: d.SITE_URL,
        ...optionalEnvBinding("CLOUDFLARE_API_TOKEN"),
        ...optionalEnvBinding("CLOUDFLARE_REALTIMEKIT_APP_ID"),
        ...optionalEnvBinding("CLOUDFLARE_STREAM_API_TOKEN"),
        ...optionalEnvBinding("CLOUDFLARE_STREAM_CUSTOMER_CODE"),
        ...optionalEnvBinding("CLOUDFLARE_STREAM_WEBHOOK_SECRET"),
        SOUNDKIT_ALLOW_MOCK_REALTIME: d.isPullRequestPreview ? "true" : "false",
        SOUNDKIT_SCHEDULED_JOBS_ENABLED: d.isProduction ? "true" : "false",
        DATABASE_URL: Config.Redacted("DATABASE_URL"),
        DO_METRICS: doMetrics,
        EMAIL_DELIVERY_QUEUE: emailDeliveryQueue,
        GOOGLE_EMBEDDING_MODEL: Config.String("GOOGLE_EMBEDDING_MODEL"),
        GOOGLE_GENERATIVE_AI_API_KEY: Config.Redacted(
          "GOOGLE_GENERATIVE_AI_API_KEY"
        ),
        HYPERDRIVE: hyperdrive,
        LIVE_NOTIFICATION_QUEUE: liveNotificationQueue,
        LIVE_RECORDING_WORKFLOW: liveRecordingWorkflow,
        LIVE_ROOMS: liveRooms,
        MEDIA_BUCKET: media,
        MEDIA_CANONICAL_URL: d.MEDIA_URL,
        MEDIA_PROCESSING_WORKFLOW: mediaProcessingWorkflow,
        MEDIA_PROCESSOR: MediaProcessorContainer,
        MEDIA_PUBLIC_URL: d.MEDIA_URL,
        MEDIA_RETENTION_WORKFLOW: mediaRetentionWorkflow,
        MUX_TOKEN_ID: Config.Redacted("MUX_TOKEN_ID"),
        MUX_TOKEN_SECRET: Config.Redacted("MUX_TOKEN_SECRET"),
        MUX_WEBHOOK_SECRET: Config.Redacted("MUX_WEBHOOK_SECRET"),
        NOTIFICATION_QUEUE: activityNotificationQueue,
        OPENAI_API_KEY: Config.Redacted("OPENAI_API_KEY"),
        PAYOUT_RUN_WORKFLOW: payoutRunWorkflow,
        PRESENCE: presence,
        PROJECT_EXPORT_WORKFLOW: projectExportWorkflow,
        PURCHASE_FULFILLMENT_WORKFLOW: purchaseFulfillmentWorkflow,
        RECORDINGS_ACCESS_KEY_ID: Config.String("RECORDINGS_ACCESS_KEY_ID"),
        RECORDINGS_BUCKET: recordings,
        RECORDINGS_BUCKET_NAME: d.resourceName("soundkit-recordings"),
        RECORDINGS_SECRET_ACCESS_KEY: Config.Redacted(
          "RECORDINGS_SECRET_ACCESS_KEY"
        ),
        SENTRY_DSN: d.SENTRY_SERVER_DSN,
        SENTRY_ENVIRONMENT: d.SENTRY_ENVIRONMENT,
        SOUNDKIT_BIO_URL: d.BIO_URL,
        SOUNDKIT_PUBLIC_URL: d.SITE_URL,
        ...optionalEnvBinding("RESEND_API_KEY"),
        ...optionalEnvBinding("RESEND_WEBHOOK_SECRET"),
        ...optionalEnvBinding("TURNSTILE_HOSTNAMES"),
        ...optionalEnvBinding("TURNSTILE_SECRET"),
        ...optionalEnvBinding("SOUNDKIT_EMAIL_FROM"),
        ...optionalEnvBinding("SOUNDKIT_EMAIL_REPLY_TO"),
        // Legacy StemSplit integration (removed #257): bindings stay
        // optional so retired credentials are never required for deploys.
        ...optionalEnvBinding("STEMSPLIT_WEBHOOK_SECRET"),
        STEM_SEPARATOR: StemSeparatorContainer,
        STRIPE_SECRET_KEY: Config.Redacted("STRIPE_SECRET_KEY"),
        ...optionalEnvBinding("STRIPE_BETTER_AUTH_WEBHOOK_SECRET"),
        ...optionalEnvBinding("STRIPE_COMMERCE_WEBHOOK_SECRET"),
        ...optionalEnvBinding("STRIPE_CONNECT_WEBHOOK_SECRET"),
        TRACK_DURATION_BACKFILL_QUEUE: trackDurationBackfillQueue,
        TRACK_ENRICHMENT_WORKFLOW: trackEnrichmentWorkflow,
        UPLOAD_BUCKET_NAME: d.MEDIA_BUCKET_NAME,
        ...optionalEnvBinding("ADMIN_EMAILS"),
        ...optionalEnvBinding("BATTLE_ADMISSION_BATCH_SIZE"),
        ...optionalEnvBinding("GOOGLE_CLIENT_ID"),
        ...optionalEnvBinding("GOOGLE_CLIENT_SECRET"),
        ...(r2Jurisdiction
          ? { CLOUDFLARE_R2_JURISDICTION: r2Jurisdiction }
          : {}),
        ...optionalEnvBinding(
          "STRIPE_SOUNDKIT_PREMIUM_ARTIST_ANNUAL_PRICE_ID"
        ),
        ...optionalEnvBinding(
          "STRIPE_SOUNDKIT_PREMIUM_ARTIST_MONTHLY_PRICE_ID"
        ),
        ...optionalEnvBinding("STRIPE_SOUNDKIT_PREMIUM_FAN_ANNUAL_PRICE_ID"),
        ...optionalEnvBinding("STRIPE_SOUNDKIT_PREMIUM_FAN_MONTHLY_PRICE_ID"),
      },
      // NOTE (v2 migration): v1 declared `placement: { region:
      // "aws:us-east-1" }`, but without a `mode` that value cannot enable
      // Smart or Targeted placement, so Cloudflare defaults applied. The
      // placement prop is intentionally omitted; add
      // `{ mode: "targeted", region: "aws:us-east-1" }` if regional
      // pinning is desired.
      main: "../../apps/server/src/index.ts",
      name: d.resourceName("soundkit-server"),
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
    };
  })
);

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

// v1 wired queue consumers via the Worker's `eventSources`. v2 declares
// them as `Consumer` resources pointing at the deployed Worker script.
const emailDeliveryConsumer = Cloudflare.Queues.Consumer(
    "email-delivery-consumer",
    Effect.gen(function* () {
      const dlq = yield* emailDeliveryDeadLetterQueue,
        queue = yield* emailDeliveryQueue,
        srv = yield* server;

      return {
        deadLetterQueue: dlq.queueName,
        queueId: queue.queueId,
        scriptName: srv.workerName,
        settings: {
          batchSize: 10,
          maxConcurrency: 5,
          maxRetries: 6,
          maxWaitTimeMs: 2500,
          retryDelay: 60,
        },
      };
    })
  ),
  liveNotificationConsumer = Cloudflare.Queues.Consumer(
    "live-notifications-consumer",
    Effect.gen(function* () {
      const dlq = yield* liveNotificationDeadLetterQueue,
        queue = yield* liveNotificationQueue,
        srv = yield* server;

      return {
        deadLetterQueue: dlq.queueName,
        queueId: queue.queueId,
        scriptName: srv.workerName,
        settings: {
          batchSize: 50,
          maxConcurrency: 10,
          maxRetries: 6,
          maxWaitTimeMs: 5000,
          retryDelay: 30,
        },
      };
    })
  ),
  activityNotificationConsumer = Cloudflare.Queues.Consumer(
    "activity-notifications-consumer",
    Effect.gen(function* () {
      const dlq = yield* activityNotificationDeadLetterQueue,
        queue = yield* activityNotificationQueue,
        srv = yield* server;

      return {
        deadLetterQueue: dlq.queueName,
        queueId: queue.queueId,
        scriptName: srv.workerName,
        settings: {
          batchSize: 25,
          maxConcurrency: 10,
          maxRetries: 6,
          maxWaitTimeMs: 2500,
          retryDelay: 30,
        },
      };
    })
  ),
  trackDurationBackfillConsumer = Cloudflare.Queues.Consumer(
    "track-duration-backfill-consumer",
    Effect.gen(function* () {
      const dlq = yield* trackDurationBackfillDeadLetterQueue,
        queue = yield* trackDurationBackfillQueue,
        srv = yield* server;

      return {
        deadLetterQueue: dlq.queueName,
        queueId: queue.queueId,
        scriptName: srv.workerName,
        settings: {
          batchSize: 10,
          maxConcurrency: 5,
          maxRetries: 5,
          maxWaitTimeMs: 2500,
          retryDelay: 30,
        },
      };
    })
  );

export default Alchemy.Stack(
  "soundkit",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    yield* media;
    yield* recordings;
    yield* emailDeliveryDeadLetterQueue;
    yield* emailDeliveryQueue;
    yield* liveNotificationDeadLetterQueue;
    yield* liveNotificationQueue;
    yield* activityNotificationDeadLetterQueue;
    yield* activityNotificationQueue;
    yield* trackDurationBackfillDeadLetterQueue;
    yield* trackDurationBackfillQueue;
    yield* hyperdrive;
    yield* MediaProcessorContainer;
    yield* StemSeparatorContainer;
    const webResource = yield* web,
      bioResource = yield* bio,
      serverResource = yield* server;
    yield* emailDeliveryConsumer;
    yield* liveNotificationConsumer;
    yield* activityNotificationConsumer;
    yield* trackDurationBackfillConsumer;

    return {
      bioUrl: bioResource.url,
      serverUrl: serverResource.url,
      webUrl: webResource.url,
    };
  })
);
