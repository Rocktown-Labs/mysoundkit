/* oxlint-disable one-var, sort-vars, node/no-mixed-requires, node/no-top-level-await -- Executable CLI awaits its read-only preflight. */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
  databaseIdentityFinding,
  deploymentEnvironment,
  isolationFindings,
  isolationMode,
} from "../packages/infra/deployment-environment.mjs";

async function readDatabaseIdentity(url) {
  if (!url) {
    throw new Error("Database URL missing");
  }
  const require = createRequire(
    new URL("../packages/db/package.json", import.meta.url)
  );
  const { Client } = require("pg"),
    client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
    });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT target FROM soundkit_environment.identity WHERE singleton = true"
    );
    return result.rows.length === 1 ? result.rows[0].target : null;
  } finally {
    await client.end();
  }
}

export async function deploymentPreflight({
  stage,
  mode = "report",
  env = process.env,
  checkDatabase = false,
  readIdentity = readDatabaseIdentity,
}) {
  const selectedMode = isolationMode(mode),
    localDev = ["true", "1", "yes", "on"].includes(
      (env.ALCHEMY_DEV ?? "").toLowerCase()
    ),
    environment = deploymentEnvironment(stage, localDev),
    databaseTarget =
      env.SOUNDKIT_DATABASE_TARGET ??
      (environment.kind === "production"
        ? "rocktownlabs/soundkit/main"
        : undefined),
    findings = isolationFindings(environment, {
      databaseTarget,
      externalEffects: env.SOUNDKIT_EXTERNAL_EFFECTS_MODE,
      hasEmailCredentials: Boolean(env.RESEND_API_KEY),
      hasFulfillmentCredentials: Boolean(
        env.PRINTFUL_API_KEY || env.KUNAKI_PASSWORD
      ),
      mediaBucket: env.SOUNDKIT_MEDIA_BUCKET_NAME ?? "soundkit-media",
      scheduledJobsEnabled: environment.scheduledJobsEnabled,
      stripeKey: env.STRIPE_SECRET_KEY,
    });
  if (environment.kind !== "production") {
    if (checkDatabase) {
      try {
        const actualTarget = await readIdentity(env.DATABASE_URL),
          finding = databaseIdentityFinding(
            environment,
            databaseTarget,
            actualTarget
          );
        if (finding) {
          findings.push(finding);
        }
      } catch {
        findings.push("database_identity_unavailable");
      }
    } else {
      findings.push("database_identity_not_checked");
    }
  }
  return {
    enforced: selectedMode === "enforce",
    findings,
    kind: environment.kind,
    passed: findings.length === 0,
    stage: environment.stage,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const { values } = parseArgs({
        options: {
          "check-database": { default: false, type: "boolean" },
          mode: { default: "report", type: "string" },
          stage: { type: "string" },
        },
        strict: true,
      }),
      report = await deploymentPreflight({
        checkDatabase: values["check-database"],
        mode: values.mode,
        stage: values.stage,
      });
    console.info(JSON.stringify(report));
    if (report.enforced && !report.passed) {
      process.exitCode = 1;
    }
  } catch {
    console.error("Deployment preflight configuration is invalid.");
    process.exitCode = 1;
  }
}
