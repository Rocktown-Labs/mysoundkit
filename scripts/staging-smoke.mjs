/* oxlint-disable one-var, sort-vars, no-await-in-loop, node/no-top-level-await -- Bounded sequential staging probes. */
import { deploymentPreflight } from "./deployment-preflight.mjs";

const api = "https://api.staging.soundkit.bio",
  origin = "https://staging.soundkit.bio";

function probe(path, options = {}) {
  return fetch(`${api}${path}`, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
}

async function playback(kind, cookie, expectedBytes) {
  const response = await probe(
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

async function login(kind) {
  const prefix = `SOUNDKIT_E2E_${kind.toUpperCase()}`,
    email = process.env[`${prefix}_EMAIL`],
    password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) {
    throw new Error("Synthetic login credentials required");
  }
  const response = await probe("/auth/sign-in/email", {
    body: JSON.stringify({ email, password }),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("Synthetic login failed");
  }
  const cookies = response.headers.getSetCookie(),
    sessionCookie = cookies.find((cookie) =>
      cookie.startsWith("__Secure-soundkit-staging.session_token=")
    );
  await response.body?.cancel();
  if (
    !sessionCookie ||
    !/;\s*domain=\.?staging\.soundkit\.bio(?:;|$)/iu.test(sessionCookie) ||
    !/;\s*httponly(?:;|$)/iu.test(sessionCookie) ||
    !/;\s*secure(?:;|$)/iu.test(sessionCookie)
  ) {
    throw new Error("Staging session cookie scope invalid");
  }
  const cookie = cookies.map((value) => value.split(";")[0]).join("; "),
    session = await probe("/auth/get-session", { headers: { cookie } });
  const sessionData = session.ok ? await session.json() : null;
  if (sessionData?.user?.id !== `staging-fixture-v1-${kind}`) {
    throw new Error("Staging cookie session invalid");
  }
  return cookie;
}

let artist,
  fan,
  phase = "preflight";
try {
  const report = await deploymentPreflight({
    checkDatabase: true,
    mode: "enforce",
    stage: "staging",
  });
  if (!report.passed) {
    throw new Error("Staging identity preflight refused smoke checks");
  }
  phase = "staging_health";
  const health = await probe("/health");
  const healthData = health.ok ? await health.json() : null;
  if (!healthData?.ok) {
    throw new Error("Staging health failed");
  }
  for (const url of [origin, "https://bio.staging.soundkit.bio"]) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    await response.body?.cancel();
    if (!response.ok) {
      throw new Error("Staging website unavailable");
    }
  }
  phase = "anonymous_media";
  await playback("free", null, 48_000);
  await playback("paid", null, null);
  await playback("private", null, null);
  phase = "artist_login";
  artist = await login("artist");
  phase = "fan_login";
  fan = await login("fan");
  phase = "authenticated_media";
  await playback("private", artist, 48_000);
  await playback("private", fan, null);
  await playback("paid", fan, null);
  await playback("paid", artist, 48_000);
  console.info(
    "Staging health, scoped cookie sessions, real media ranges and owner/fan/anonymous boundaries passed."
  );
} catch {
  console.error(
    `Staging smoke failed (${phase}); credentials, cookies and provider details redacted.`
  );
  process.exitCode = 1;
} finally {
  for (const cookie of [artist, fan].filter(Boolean)) {
    try {
      const response = await probe("/auth/sign-out", {
        headers: { cookie, origin },
        method: "POST",
      });
      await response.body?.cancel();
      if (!response.ok) {
        process.exitCode = 1;
      }
    } catch {
      process.exitCode = 1;
    }
  }
}
