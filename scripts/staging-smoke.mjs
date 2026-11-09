/* oxlint-disable one-var, sort-vars, no-await-in-loop, node/no-top-level-await -- Bounded sequential staging probes. */
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { deploymentRouting } from "../packages/infra/deployment-environment.mjs";
import { deploymentPreflight } from "./deployment-preflight.mjs";

export function smokeTarget(stage = "staging") {
  if (stage !== "staging" && !/^pr-[1-9]\d*$/u.test(stage)) {
    throw new Error("Only synthetic staging or PR smoke targets are allowed");
  }
  const routing = deploymentRouting(stage, false, true);
  return {
    api: `https://${routing.apiHost}`,
    bio: `https://${routing.bioHost}`,
    cookieDomain: routing.siteHost,
    cookieName: `__Secure-soundkit-${stage}.session_token`,
    origin: `https://${routing.siteHost}`,
    stage,
  };
}

function createProbe(target) {
  return (path, options = {}) =>
    fetch(`${target.api}${path}`, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
}

const staging = smokeTarget(),
  probe = createProbe(staging);

async function playback(kind, cookie, expectedBytes, request) {
  const response = await request(
    `/v1/tracks/staging-fixture-v1-track-${kind}/playback`,
    {
      headers: { ...(cookie ? { cookie } : {}), range: "bytes=0-43" },
    }
  );
  if (expectedBytes === null) {
    if (![403, 404].includes(response.status)) {
      throw new Error("Restricted fixture unexpectedly accessible");
    }
    await response.body?.cancel();
    return;
  }
  if (response.status !== 206) {
    await response.body?.cancel();
    throw new Error("Fixture range playback failed");
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (
    data.length !== 44 ||
    data.toString("ascii", 0, 4) !== "RIFF" ||
    data.readUInt32LE(40) !== expectedBytes
  ) {
    throw new Error("Fixture playback returned incorrect media");
  }
}

async function login(kind, request, target) {
  const prefix = `SOUNDKIT_E2E_${kind.toUpperCase()}`,
    email = process.env[`${prefix}_EMAIL`],
    password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) {
    throw new Error("Synthetic login credentials required");
  }
  const response = await request("/auth/sign-in/email", {
    body: JSON.stringify({ email, password }),
    headers: { "content-type": "application/json", origin: target.origin },
    method: "POST",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("Synthetic login failed");
  }
  const cookies = response.headers.getSetCookie(),
    sessionCookie = cookies.find((cookie) =>
      cookie.startsWith(`${target.cookieName}=`)
    );
  await response.body?.cancel();
  const attributes = new Set(
    (sessionCookie ?? "")
      .toLowerCase()
      .split(";")
      .slice(1)
      .map((value) => value.trim())
  );
  if (
    !sessionCookie ||
    ![`domain=${target.cookieDomain}`, `domain=.${target.cookieDomain}`].some(
      (attribute) => attributes.has(attribute)
    ) ||
    !attributes.has("httponly") ||
    !attributes.has("secure")
  ) {
    throw new Error("Staging session cookie scope invalid");
  }
  const [cookie] = sessionCookie.split(";"),
    session = await request("/auth/get-session", { headers: { cookie } });
  const sessionData = session.ok ? await session.json() : null;
  if (sessionData?.user?.id !== `staging-fixture-v1-${kind}`) {
    throw new Error("Staging cookie session invalid");
  }
  return cookie;
}

export async function logoutStaging(
  cookie,
  request = probe,
  origin = staging.origin
) {
  const response = await request("/auth/sign-out", {
    body: "{}",
    headers: { "content-type": "application/json", cookie, origin },
    method: "POST",
  });
  await response.body?.cancel();
  if (!response.ok) {
    throw new Error("Synthetic logout failed");
  }
  const session = await request("/auth/get-session", {
    headers: { cookie },
  });
  if (!session.ok || (await session.json()) !== null) {
    throw new Error("Synthetic session remained valid after logout");
  }
}

export async function smokeStaging({ stage = "staging" } = {}) {
  const target = smokeTarget(stage),
    request = createProbe(target);
  let artist,
    fan,
    phase = "preflight";
  try {
    const report = await deploymentPreflight({
      checkDatabase: true,
      mode: "enforce",
      stage,
    });
    if (!report.passed) {
      throw new Error("Staging identity preflight refused smoke checks");
    }
    phase = "staging_health";
    const health = await request("/health");
    const healthData = health.ok ? await health.json() : null;
    if (!healthData?.ok) {
      throw new Error("Staging health failed");
    }
    for (const url of [target.origin, target.bio]) {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });
      await response.body?.cancel();
      if (
        !response.ok ||
        new URL(response.url).origin !== new URL(url).origin
      ) {
        throw new Error(
          "Staging website unavailable or redirected outside its origin"
        );
      }
    }
    phase = "anonymous_media";
    await playback("free", null, 48_000, request);
    await playback("paid", null, null, request);
    await playback("private", null, null, request);
    phase = "artist_login";
    artist = await login("artist", request, target);
    phase = "fan_login";
    fan = await login("fan", request, target);
    phase = "authenticated_media";
    await playback("private", artist, 48_000, request);
    await playback("private", fan, null, request);
    await playback("paid", fan, null, request);
    await playback("paid", artist, 48_000, request);
    console.info(
      "Staging health, scoped cookie sessions, real media ranges and owner/fan/anonymous boundaries passed."
    );
  } catch {
    console.error(
      `Synthetic ${stage} smoke failed (${phase}); credentials, cookies and provider details redacted.`
    );
    process.exitCode = 1;
  } finally {
    for (const cookie of [artist, fan].filter(Boolean)) {
      try {
        await logoutStaging(cookie, request, target.origin);
      } catch {
        console.error(
          "Staging logout cleanup failed; session details redacted."
        );
        process.exitCode = 1;
      }
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const { values } = parseArgs({
      options: { stage: { default: "staging", type: "string" } },
      strict: true,
    });
    await smokeStaging({ stage: values.stage });
  } catch {
    console.error(
      "Synthetic smoke configuration invalid; credentials redacted."
    );
    process.exitCode = 1;
  }
}
