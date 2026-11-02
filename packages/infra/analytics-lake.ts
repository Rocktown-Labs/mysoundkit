/* eslint-disable sort-vars, one-var, unicorn/no-array-method-this-argument */
import { createHash } from "node:crypto";

import * as Cloudflare from "alchemy/Cloudflare";
import * as Output from "alchemy/Output";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

export const analyticsLake = Cloudflare.R2.Bucket(
  "analytics-lake",
  Effect.gen(function* analyticsLake() {
    const stage = yield* Stage;
    return {
      forceDestroy: stage !== "prod",
      lifecycleRules: [
        {
          deleteObjectsTransition: {
            condition: { maxAge: 30 * 86_400, type: "Age" as const },
          },
          enabled: true,
          id: "raw-events-30-days",
        },
      ],
      name: `soundkit-analytics-${stage}`,
      publicAccess: false,
    };
  })
).pipe(
  RemovalPolicy.retain(
    Effect.gen(function* analyticsLake() {
      return (yield* Stage) === "prod";
    })
  )
);

const sinkToken = Cloudflare.ApiToken.AccountApiToken(
  "analytics-sink-token",
  Effect.gen(function* sinkToken() {
    const bucket = yield* analyticsLake,
      { accountId } = yield* yield* Cloudflare.CloudflareEnvironment;
    if (!accountId) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
    }
    return {
      accountId,
      policies: Output.map(bucket.bucketName, (name) => [
        {
          effect: "allow" as const,
          permissionGroups: [
            "Workers R2 Storage Bucket Item Read" as const,
            "Workers R2 Storage Bucket Item Write" as const,
          ],
          resources: {
            [`com.cloudflare.edge.r2.bucket.${accountId}_default_${name}`]: "*",
          },
        },
      ]),
    };
  })
);

export const analyticsStream = Cloudflare.Pipelines.Stream(
  "analytics-events-v1",
  {
    http: { authentication: true, enabled: false },
    schema: {
      fields: [
        ...[
          "event_id",
          "event_type",
          "occurred_at",
          "environment",
          "subject_key",
          "cohort_day",
          "kind",
          "currency",
          "producer_version",
          "policy_version",
        ].map((name) => ({ name, required: true, type: "string" as const })),
        { name: "amount_cents", required: true, type: "int64" },
        { name: "schema_version", required: true, type: "int32" },
      ],
    },
    workerBinding: { enabled: true },
  }
);

const sink = Cloudflare.Pipelines.Sink(
  "analytics-archive-v1",
  Effect.gen(function* sink() {
    const bucket = yield* analyticsLake,
      token = yield* sinkToken;
    return {
      config: {
        bucket: bucket.bucketName,
        // R2 S3 credentials use token ID + SHA-256(token value).
        // https://developers.cloudflare.com/r2/api/tokens/
        credentials: {
          accessKeyId: Output.map(token.tokenId, Redacted.make),
          secretAccessKey: Output.map(token.value, (value) =>
            Redacted.make(
              createHash("sha256").update(Redacted.value(value)).digest("hex")
            )
          ),
        },
        partitioning: { timePattern: "year=%Y/month=%m/day=%d" },
        path: "events/v1",
        rollingPolicy: { intervalSeconds: 60 },
      },
      format: { type: "json" as const },
      type: "r2" as const,
    };
  })
);

export const analyticsPipeline = Cloudflare.Pipelines.Pipeline(
  "analytics-export-v1",
  Effect.gen(function* analyticsPipeline() {
    const source = yield* analyticsStream,
      archive = yield* sink;
    return {
      sql: Output.map(
        Output.all(archive.name, source.name),
        ([archiveName, sourceName]) =>
          `INSERT INTO ${archiveName} SELECT * FROM ${sourceName}`
      ),
    };
  })
);
