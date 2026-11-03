/* oxlint-disable one-var, sort-vars, node/no-mixed-requires, node/no-top-level-await -- Sequential nonproduction fixture creation with no credential output. */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export const fixtureAccounts = Object.freeze([
  {
    accountType: "artist",
    email: "soundkit-fixture-artist@example.test",
    id: "staging-fixture-v1-artist",
    kind: "artist",
    username: "staging-fixture-artist",
  },
  {
    accountType: "fan",
    email: "soundkit-fixture-fan@example.test",
    id: "staging-fixture-v1-fan",
    kind: "fan",
    username: "staging-fixture-fan",
  },
  {
    accountType: "artist",
    email: "soundkit-fixture-collaborator@example.test",
    id: "staging-fixture-v1-collaborator",
    kind: "collaborator",
    username: "staging-fixture-collaborator",
  },
]);
export const fixtureTracks = Object.freeze([
  { forSale: false, kind: "free", public: true },
  { forSale: true, kind: "paid", public: true },
  { forSale: false, kind: "private", public: false },
]);

async function seedCredential(
  client,
  account,
  password,
  { hashPassword, verifyPassword }
) {
  const existing = await client.query(
    'SELECT email FROM public."user" WHERE id=$1',
    [account.id]
  );
  if (existing.rows.length && existing.rows[0].email !== account.email) {
    throw new Error(
      "Fixture identity collision; no existing account overwritten"
    );
  }
  await client.query(
    'INSERT INTO public."user"(id,name,email,email_verified) VALUES($1,$2,$3,true) ON CONFLICT(id) DO NOTHING',
    [account.id, `SoundKit Fixture ${account.kind}`, account.email]
  );
  const credentialId = `${account.id}-credential`;
  const credentials = await client.query(
    "SELECT password,user_id,provider_id FROM public.account WHERE id=$1",
    [credentialId]
  );
  const [credential] = credentials.rows;
  if (credential) {
    if (
      credential.user_id !== account.id ||
      credential.provider_id !== "credential" ||
      !credential.password ||
      !(await verifyPassword({
        hash: credential.password,
        password,
      }))
    ) {
      throw new Error("Fixture credentials differ; explicit rotation required");
    }
  } else {
    const passwordHash = await hashPassword(password);
    await client.query(
      "INSERT INTO public.account(id,account_id,provider_id,user_id,password,updated_at) VALUES($1,$2,'credential',$2,$3,now())",
      [credentialId, account.id, passwordHash]
    );
  }
  await seedProfile(client, account);
}

async function seedProfile(client, account) {
  await client.query(
    "INSERT INTO public.user_profiles(user_id,account_type,username,display_name,country,state,city,onboarding_completed_at) VALUES($1,$2,$3,$4,'US',$5,$6,now()) ON CONFLICT(user_id) DO NOTHING",
    [
      account.id,
      account.accountType,
      account.username,
      `Fixture ${account.kind}`,
      account.accountType === "artist" ? "AR" : "TX",
      account.accountType === "artist" ? "Little Rock" : "Houston",
    ]
  );
  if (account.accountType === "artist") {
    const org = `${account.id}-org`;
    await client.query(
      "INSERT INTO public.organization(id,name,slug,created_at) VALUES($1,$2,$1,now()) ON CONFLICT(id) DO NOTHING",
      [org, `Fixture ${account.kind}`]
    );
    await client.query(
      "INSERT INTO public.member(id,user_id,organization_id,role) VALUES($1,$2,$3,'owner') ON CONFLICT(id) DO NOTHING",
      [`${account.id}-membership`, account.id, org]
    );
    await client.query(
      "INSERT INTO public.artist_profiles(user_id,stage_name,hometown,primary_organization_id) VALUES($1,$2,'Little Rock',$3) ON CONFLICT(user_id) DO NOTHING",
      [account.id, `Fixture ${account.kind}`, org]
    );
  } else {
    await client.query(
      "INSERT INTO public.fan_profiles(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",
      [account.id]
    );
  }
}

async function seedCatalog(client, mediaBucket) {
  await client.query(
    "INSERT INTO public.genres(id,name,slug) VALUES('staging-fixture-v1-genre','Hip-Hop','hip-hop') ON CONFLICT(slug) DO NOTHING"
  );
  const [artist] = fixtureAccounts;
  for (const track of fixtureTracks) {
    const id = `staging-fixture-v1-track-${track.kind}`;
    await client.query(
      "INSERT INTO public.tracks(id,owner_user_id,title,slug,is_public,is_for_sale,price_cents,listening_access,genre_id,production_status,release_strategy,published_at,downloads_require_first_play) VALUES($1,$2,$3,$1,$4,$5,$6,$7,(SELECT id FROM public.genres WHERE slug='hip-hop'),'complete',$8,$9,false) ON CONFLICT(id) DO NOTHING",
      [
        id,
        artist.id,
        `Fixture ${track.kind} tone`,
        track.public,
        track.forSale,
        track.forSale ? 100 : null,
        track.forSale ? "premium_or_purchased" : "public",
        track.public ? "publish_when_ready" : "private",
        track.public ? new Date() : null,
      ]
    );
    await client.query(
      "INSERT INTO public.track_assets(id,track_id,asset_kind,purpose,storage_provider,bucket_name,object_key,status,mime_type,duration_ms) VALUES($1,$2,'master','master','r2',$3,$4,'ready','audio/wav',3000) ON CONFLICT(id) DO NOTHING",
      [`${id}-master`, id, mediaBucket, `staging-fixtures/v1/${track.kind}.wav`]
    );
    if (track.forSale) {
      await client.query(
        "INSERT INTO public.track_assets(id,track_id,asset_kind,purpose,storage_provider,bucket_name,object_key,status,mime_type,duration_ms) VALUES($1,$2,'master','preview','r2',$3,'staging-fixtures/v1/paid-preview.wav','ready','audio/wav',1000) ON CONFLICT(id) DO NOTHING",
        [`${id}-preview`, id, mediaBucket]
      );
    }
  }
}

/** No provider calls or financial ledger rows; this function accepts staging only. */
export async function seedStaging({ client, target, passwords, mediaBucket }) {
  if (
    target !== "rocktownlabs/soundkit/staging" ||
    mediaBucket !== "soundkit-media-staging"
  ) {
    throw new Error("Explicit isolated staging target/media required");
  }
  for (const account of fixtureAccounts) {
    const password = passwords?.[account.kind];
    if (
      typeof password !== "string" ||
      password.length < 32 ||
      password.length > 128
    ) {
      throw new Error("Strong fixture passwords must be supplied privately");
    }
  }
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query("SET LOCAL lock_timeout='3s'");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('soundkit-staging-fixtures-v1',0))"
    );
    const identity = await client.query(
      "SELECT target FROM soundkit_environment.identity WHERE singleton=true"
    );
    if (identity.rows.length !== 1 || identity.rows[0].target !== target) {
      throw new Error(
        "Actual database is not the approved staging environment"
      );
    }
    const requireAuth = createRequire(
      new URL("../packages/auth/package.json", import.meta.url)
    );
    const { hashPassword, verifyPassword } = await import(
      requireAuth.resolve("better-auth/crypto")
    );
    for (const account of fixtureAccounts) {
      await seedCredential(client, account, passwords[account.kind], {
        hashPassword,
        verifyPassword,
      });
    }
    await seedCatalog(client, mediaBucket);
    await client.query("COMMIT");
    return {
      accounts: fixtureAccounts.length,
      mediaObjectsRequired: [
        "free.wav",
        "paid.wav",
        "private.wav",
        "paid-preview.wav",
      ],
      target,
      tracks: fixtureTracks.length,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* Connection termination also aborts the transaction. */
    }
    throw error;
  }
}

function handleConnectionError() {
  // Driver messages may contain connection details; fail without emitting them.
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let client;
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("Explicit staging runtime connection required");
    }
    const requireDb = createRequire(
      new URL("../packages/db/package.json", import.meta.url)
    );
    const { Client } = requireDb("pg");
    client = new Client({
      application_name: "soundkit/test",
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      query_timeout: 35_000,
    });
    client.on("error", handleConnectionError);
    await client.connect();
    const result = await seedStaging({
      client,
      mediaBucket: process.env.SOUNDKIT_MEDIA_BUCKET_NAME,
      passwords: {
        artist: process.env.SOUNDKIT_E2E_ARTIST_PASSWORD,
        collaborator: process.env.SOUNDKIT_E2E_COLLABORATOR_PASSWORD,
        fan: process.env.SOUNDKIT_E2E_FAN_PASSWORD,
      },
      target: process.env.SOUNDKIT_DATABASE_TARGET,
    });
    console.info(JSON.stringify(result));
  } catch {
    console.error(
      "Staging fixtures failed; credentials and database details are redacted."
    );
    process.exitCode = 1;
  } finally {
    try {
      await client?.end();
    } catch {
      console.error("Staging database cleanup failed; details are redacted.");
      process.exitCode = 1;
    }
  }
}
