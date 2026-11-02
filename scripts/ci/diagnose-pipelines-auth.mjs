/* oxlint-disable one-var, sort-vars, node/no-top-level-await -- Sequential CLI probes depend on earlier responses; the executable entrypoint awaits completion. */
import { pathToFileURL } from "node:url";

const pipelinePermissions = new Set([
  "Pipelines Read",
  "Pipelines Write",
  "Workers Pipelines Read",
  "Workers Pipelines Edit",
]);

function failureKind(error) {
  if (error instanceof SyntaxError) {
    return "invalid_json";
  }
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return "timeout";
  }
  return "network";
}

function tokenLabel(details, token, enabled) {
  if (
    !enabled ||
    !details?.success ||
    typeof details.result?.name !== "string"
  ) {
    return [];
  }
  return [
    {
      name: details.result.name.replaceAll(token, "[redacted]").slice(0, 120),
      probe: "ci_token_label",
    },
  ];
}

export async function diagnosePipelinesAuth(
  env,
  fetchImpl = fetch,
  { includeTokenName = false } = {}
) {
  const account = env.CLOUDFLARE_ACCOUNT_ID,
    token = env.CLOUDFLARE_API_TOKEN;
  if (!/^[a-f\d]{32}$/iu.test(account ?? "") || !token?.trim()) {
    throw new Error("Cloudflare CI credentials are not configured.");
  }
  const reports = [];
  async function probe(label, path) {
    try {
      const response = await fetchImpl(
          `https://api.cloudflare.com/client/v4/${path}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            method: "GET",
            redirect: "error",
            signal: AbortSignal.timeout(15_000),
          }
        ),
        body = await response.json();
      reports.push({
        codes: Array.isArray(body.errors)
          ? body.errors.map((error) => error.code).filter(Number.isInteger)
          : [],
        probe: label,
        status: response.status,
        success: body.success === true,
      });
      return body;
    } catch (error) {
      reports.push({
        failureKind: failureKind(error),
        probe: label,
        transportFailed: true,
      });
    }
  }
  await Promise.all([
    probe("workers_control", `accounts/${account}/workers/scripts`),
    probe(
      "pipeline_streams",
      `accounts/${account}/pipelines/v1/streams?per_page=1`
    ),
    probe(
      "pipeline_sinks",
      `accounts/${account}/pipelines/v1/sinks?per_page=1`
    ),
  ]);
  for (const [label, prefix] of [
    ["user_token", "user"],
    ["account_token", `accounts/${account}`],
  ]) {
    const verified = await probe(`${label}_verify`, `${prefix}/tokens/verify`);
    if (
      !verified?.success ||
      !/^[a-f\d]{32}$/iu.test(verified.result?.id ?? "")
    ) {
      continue;
    }
    const details = await probe(
      `${label}_details`,
      `${prefix}/tokens/${verified.result.id}`
    );
    reports.push(...tokenLabel(details, token, includeTokenName));
    if (details?.success && Array.isArray(details.result?.policies)) {
      const policies = details.result.policies.flatMap((policy) => {
        const permissions = (policy.permission_groups ?? [])
          .map((group) => group.name)
          .filter((name) => pipelinePermissions.has(name));
        if (permissions.length === 0) {
          return [];
        }
        const resources = policy.resources ?? {};
        return [
          {
            effect: policy.effect === "allow" ? "allow" : "deny",
            permissions,
            targetAccountIncluded: [
              "*",
              "com.cloudflare.api.account.*",
              `com.cloudflare.api.account.${account}`,
            ].some((key) => Object.hasOwn(resources, key)),
          },
        ];
      });
      reports.push({ policies, probe: "pipeline_policy_metadata" });
    }
    break;
  }
  return reports;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const reports = await diagnosePipelinesAuth(process.env, fetch, {
      includeTokenName: process.env.SOUNDKIT_DIAGNOSTIC_TOKEN_NAME === "true",
    });
    for (const report of reports) {
      console.info(JSON.stringify(report));
    }
  } catch {
    console.error(
      "Cloudflare auth diagnostics could not start; check credential configuration."
    );
    process.exitCode = 1;
  }
}
