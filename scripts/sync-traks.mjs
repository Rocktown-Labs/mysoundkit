/* eslint-disable one-var, sort-vars */
import { readFile } from "node:fs/promises";

const endpoint = "https://traks-api.rocktown-labs.workers.dev/api/mcp";

export function goalIdentity(goal) {
  return JSON.stringify([
    goal.type,
    goal.target,
    goal.propKey ?? null,
    goal.propValue ?? null,
  ]);
}

export function missingConfiguration(site, goals, funnels) {
  for (const desired of site.funnels) {
    const existing = funnels.find((funnel) => funnel.name === desired.name);
    if (
      existing &&
      JSON.stringify(existing.steps.map(goalIdentity)) !==
        JSON.stringify(desired.steps.map(goalIdentity))
    ) {
      throw new Error(
        `Funnel configuration drift: ${desired.name}. Review the existing steps before updating.`
      );
    }
  }
  const knownGoals = new Set(goals.map(goalIdentity)),
    knownFunnels = new Set(funnels.map((funnel) => funnel.name));
  return {
    funnels: site.funnels.filter((funnel) => !knownFunnels.has(funnel.name)),
    goals: site.goals.filter((goal) => !knownGoals.has(goalIdentity(goal))),
  };
}

async function main() {
  const token = process.env.TRAKS_API_TOKEN?.trim();
  if (!token) {
    throw new Error("Set TRAKS_API_TOKEN in the environment.");
  }
  const headers = {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "soundkit-analytics-mcp/1.0",
    },
    manifest = JSON.parse(
      await readFile(
        new URL("../docs/analytics/traks-manifest.json", import.meta.url),
        "utf-8"
      )
    );
  let id = 0;
  async function rpc(method, params) {
    id += 1;
    const response = await fetch(endpoint, {
      body: JSON.stringify({ id, jsonrpc: "2.0", method, params }),
      headers,
      method: "POST",
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(`Traks MCP HTTP ${response.status}`);
    }
    const session = response.headers.get("mcp-session-id");
    if (session) {
      headers["Mcp-Session-Id"] = session;
    }
    const text = await response.text();
    let payload = text;
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      const data = text
        .split(/\r?\n/u)
        .findLast((line) => line.startsWith("data: "));
      if (!data) {
        throw new Error(
          `Traks MCP returned an empty event stream for ${method}.`
        );
      }
      payload = data.slice(6);
    }
    const message = JSON.parse(payload);
    if (message.error || message.result?.isError) {
      throw new Error("Traks MCP rejected the request.");
    }
    return message.result;
  }
  async function tool(name, args = {}) {
    const result = await rpc("tools/call", { arguments: args, name }),
      text = result.content?.find((item) => item.type === "text")?.text,
      payload = text ? JSON.parse(text) : result.structuredContent;
    if (!payload || payload.error) {
      throw new Error(`Invalid response from ${name}.`);
    }
    return payload.data ?? payload;
  }
  await rpc("initialize", {
    capabilities: {},
    clientInfo: { name: "soundkit-analytics-sync", version: "1.0" },
    protocolVersion: "2024-11-05",
  });
  // Validate configured domains against the authenticated account before writes.
  const sites = await tool("list_sites");
  for (const site of manifest.sites) {
    if (
      !sites.some(
        (known) => known.id === site.siteId && known.domain === site.domain
      )
    ) {
      throw new Error(`Site mismatch for ${site.domain}.`);
    }
    const goals = await tool("list_goals", { siteId: site.siteId }),
      funnels = await tool("list_funnels", { siteId: site.siteId }),
      missing = missingConfiguration(site, goals, funnels);
    console.info(
      `${site.domain}: ${missing.goals.length} missing goals; ${missing.funnels.length} missing funnels.`
    );
    if (!process.argv.includes("--apply")) {
      continue;
    }
    for (const goal of missing.goals) {
      await tool("create_goal", { siteId: site.siteId, ...goal });
    }
    for (const funnel of missing.funnels) {
      await tool("create_funnel", { siteId: site.siteId, ...funnel });
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file:").href
) {
  try {
    // This executable is imported by tests without executing main.
    // eslint-disable-next-line node/no-top-level-await
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
