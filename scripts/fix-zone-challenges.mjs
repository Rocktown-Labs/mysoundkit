#!/usr/bin/env node
// Fix #1 of https://github.com/Rocktown-Labs/mysoundkit/issues/366
//
// The mysoundkit.com zone (Cloudflare Free plan) challenges datacenter /
// "likely automated" traffic: every api.mysoundkit.com fetch from a lab
// browser (PageSpeed Insights, Lighthouse, CI) returns a 403 managed
// challenge with no CORS headers, so the homepage renders empty and retries
// ~4x per endpoint; /assets/*.json (e.g. world-countries-110m) 403s too.
//
// On the Free plan, Bot Fight Mode cannot be skipped by WAF rules, so this
// script disables it via PUT /zones/{id}/bot_management { fight_mode: false }
// and adds idempotent WAF skip rules (Rulesets API, http_request_firewall_custom
// phase) that stop Security Level / Browser Integrity Check challenges for
// public GET API endpoints and content-hashed static assets.
//
// Usage:
//   node scripts/fix-zone-challenges.mjs             # diagnose only (no changes)
//   node scripts/fix-zone-challenges.mjs --apply     # apply the fixes
//
// Requires CLOUDFLARE_API_TOKEN with, scoped to the zone:
//   Zone: Read, Zone Settings: Edit, Rulesets: Edit, Bot Management: Edit

const API = "https://api.cloudflare.com/client/v4",
  API_HOST = "api.mysoundkit.com",
  ORIGIN = "https://mysoundkit.com",
  // Public GET endpoints fetched on page load. These require no auth to
  // return public data, so challenging them adds no real protection.
  PUBLIC_API_PATH_PREFIXES = [
    "/auth/get-session",
    "/v1/artists",
    "/v1/battles",
    "/v1/listening-parties",
    "/v1/live/experiences/public",
    "/v1/me",
    "/v1/projects/public",
    "/v1/tracks",
    "/v1/videos",
  ],
  TOKEN = process.env.CLOUDFLARE_API_TOKEN,
  ZONE_NAME = process.env.ZONE_NAME ?? "mysoundkit.com",
  apply = process.argv.includes("--apply"),
  // Security Level (zone threat-score challenges) and Browser Integrity
  // Check are the two zone-wide products that can still challenge these
  // requests once Bot Fight Mode is off.
  skipParameters = {
    action: "skip",
    action_parameters: { products: ["securityLevel", "bic"] },
  },
  wantedRules = [
    {
      ...skipParameters,
      description:
        "Skip challenges for public API GET reads (PageSpeed fix #366)",
      enabled: true,
      expression: `(http.request.method eq "GET" and ${PUBLIC_API_PATH_PREFIXES.map(
        (pathPrefix) => `starts_with(http.request.uri.path, "${pathPrefix}")`
      ).join(" or ")})`,
    },
    {
      ...skipParameters,
      description: "Skip challenges for content-hashed static assets (#366)",
      enabled: true,
      expression: 'starts_with(http.request.uri.path, "/assets/")',
    },
  ];

if (!TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is not set.");
  process.exit(1);
}

async function api(path, method, body) {
  const answer = await fetch(`${API}${path}`, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      method: method ?? "GET",
    }),
    json = await answer.json().catch(() => null);
  return { json, status: answer.status };
}

function result({ json, status }) {
  if (!json) {
    throw new Error(`HTTP ${status} (non-JSON response)`);
  }
  if (!json.success) {
    throw new Error(`HTTP ${status}: ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.result;
}

async function getZone() {
  const [zone] = result(
    await api(`/zones?name=${encodeURIComponent(ZONE_NAME)}`)
  );
  if (!zone) {
    throw new Error(`Zone ${ZONE_NAME} not found.`);
  }
  console.log(`zone: ${zone.name} (${zone.id}) plan: ${zone.plan.name}`);
  return zone;
}

async function diagnose(zone) {
  for (const setting of ["security_level", "browser_check"]) {
    try {
      const value = result(await api(`/zones/${zone.id}/settings/${setting}`));
      console.log(`${setting}: ${value.value}`);
    } catch (error) {
      console.log(`${setting}: unreadable (${error.message})`);
    }
  }

  try {
    const bots = result(await api(`/zones/${zone.id}/bot_management`));
    console.log(`bot_management: ${JSON.stringify(bots)}`);
  } catch (error) {
    console.log(`bot_management: unreadable (${error.message})`);
  }

  const entrypoint = await api(
      `/zones/${zone.id}/rulesets/phases/http_request_firewall_custom/entrypoint`
    ),
    ruleset = entrypoint.json?.result ?? null;
  if (ruleset) {
    console.log(`custom rules: ${(ruleset.rules ?? []).length}`);
    for (const rule of ruleset.rules ?? []) {
      console.log(
        `  - [${rule.enabled ? "on" : "off"}] ${rule.description} (${rule.action})`
      );
    }
  } else if (entrypoint.status === 404) {
    console.log("custom rules: none (entrypoint ruleset does not exist yet)");
  } else {
    console.log(`custom rules: unreadable (HTTP ${entrypoint.status})`);
  }
  return ruleset;
}

async function disableBotFightMode(zone) {
  const botsGet = await api(`/zones/${zone.id}/bot_management`),
    current = botsGet.json?.result ?? {};
  if (botsGet.status !== 200) {
    console.log(
      `bot fight mode: could not manage via API (${botsGet.status}) — turn it off in the dashboard: Security → Settings → Bot Fight Mode`
    );
    return;
  }
  if (current.fight_mode === true) {
    result(
      await api(`/zones/${zone.id}/bot_management`, "PUT", {
        fight_mode: false,
      })
    );
    console.log("bot fight mode: disabled");
  } else {
    console.log(`bot fight mode: already off (${JSON.stringify(current)})`);
  }
}

async function addRule(zone, ruleset, rule) {
  const create = await api(
    `/zones/${zone.id}/rulesets/${ruleset.id}/rules`,
    "POST",
    { ...rule, position: { index: 0 } }
  );
  if (create.status === 200 || create.status === 201) {
    console.log(`rule "${rule.description}": added at the top`);
    return;
  }
  // Fall back to appending without an explicit position if the API rejects
  // the position object.
  result(
    await api(`/zones/${zone.id}/rulesets/${ruleset.id}/rules`, "POST", rule)
  );
  console.log(`rule "${rule.description}": added (appended)`);
}

async function ensureSkipRules(zone, ruleset) {
  if (!ruleset) {
    const created = result(
      await api(`/zones/${zone.id}/rulesets`, "POST", {
        description: "Custom rules for mysoundkit.com",
        kind: "zone",
        name: "default",
        phase: "http_request_firewall_custom",
        rules: wantedRules,
      })
    );
    console.log(`custom ruleset created (${created.id}), 2 skip rules added`);
    return;
  }
  const existing = new Set((ruleset.rules ?? []).map((r) => r.description));
  for (const rule of wantedRules) {
    if (existing.has(rule.description)) {
      console.log(`rule "${rule.description}": already present`);
      continue;
    }
    await addRule(zone, ruleset, rule);
  }
}

async function verifyFromDatacenter() {
  console.log("\nverifying from this machine (a datacenter client)...");
  const checks = [
    `https://${API_HOST}/v1/artists?category=top&limit=10&region=all&regionType=global&sort=rank-asc`,
    "https://mysoundkit.com/",
  ];
  for (const url of checks) {
    try {
      const answer = await fetch(url, { headers: { Origin: ORIGIN } }),
        cors = answer.headers.get("access-control-allow-origin"),
        isApi = url.includes("api"),
        { status } = answer,
        verdict = status === 200 ? "OK " : "BAD";
      console.log(
        `${verdict} ${url} -> ${status}` +
          `${isApi ? ` (access-control-allow-origin: ${cors})` : ""}`
      );
    } catch (error) {
      console.log(`ERR ${url} -> ${error.message}`);
    }
  }
}

async function main() {
  const activeZone = await getZone(),
    ruleset = await diagnose(activeZone);
  if (!apply) {
    console.log("\nDry run (diagnose only). Re-run with --apply to fix.");
    return;
  }
  console.log("\napplying fixes...");
  await disableBotFightMode(activeZone);
  await ensureSkipRules(activeZone, ruleset);
  await verifyFromDatacenter();
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void run();
