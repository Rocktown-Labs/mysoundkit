/* oxlint-disable one-var, sort-vars, no-await-in-loop, node/no-mixed-requires, unicorn/no-await-expression-member -- Disposable local PostgreSQL integration fixture. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

import {
  bootstrapStaging,
  publicSchemaBaseline,
} from "./staging-bootstrap.mjs";
import { seedStaging } from "./staging-fixtures.mjs";

// Minimal real SQL baseline exercises the bootstrap's reviewed analytics DDL and
// every seeder write. Full application schema was additionally installed on the
// empty remote staging branch; no production connection is accepted here.
const schema = `
CREATE TABLE public."user"(id text PRIMARY KEY,name text,email text UNIQUE,email_verified boolean,created_at timestamptz DEFAULT now());
CREATE TABLE public.account(id text PRIMARY KEY,account_id text,provider_id text,user_id text REFERENCES public."user",password text,updated_at timestamptz);
CREATE TABLE public.organization(id text PRIMARY KEY,name text,slug text UNIQUE,created_at timestamptz);
CREATE TABLE public.member(id text PRIMARY KEY,user_id text,organization_id text REFERENCES public.organization,role text);
CREATE TABLE public.user_profiles(user_id text PRIMARY KEY,account_type text,username text,display_name text,country text,state text,city text,onboarding_completed_at timestamptz);
CREATE TABLE public.artist_profiles(user_id text PRIMARY KEY,stage_name text,hometown text,primary_organization_id text REFERENCES public.organization);
CREATE TABLE public.fan_profiles(user_id text PRIMARY KEY);
CREATE TABLE public.genres(id text PRIMARY KEY,name text,slug text UNIQUE);
CREATE TABLE public.tracks(id text PRIMARY KEY,owner_user_id text,title text,slug text,is_public boolean,is_for_sale boolean,price_cents integer,listening_access text,genre_id text REFERENCES public.genres,production_status text,release_strategy text,published_at timestamptz,downloads_require_first_play boolean,organization_id text REFERENCES public.organization);
CREATE TABLE public.track_assets(id text PRIMARY KEY,track_id text REFERENCES public.tracks,asset_kind text,purpose text,storage_provider text,bucket_name text,object_key text,status text,mime_type text,duration_ms integer,source_asset_id text REFERENCES public.track_assets,metadata jsonb);
CREATE TABLE public.transactions(id text PRIMARY KEY,status text);
CREATE TABLE public.subscription(id text PRIMARY KEY,status text);
CREATE TABLE public.payment_refunds(id text PRIMARY KEY);
CREATE TABLE public.orders(id text PRIMARY KEY,status text);
CREATE TABLE public.purchases(id text PRIMARY KEY);
CREATE TABLE public.videos(id text PRIMARY KEY,published_at timestamptz,is_public boolean,status text);
CREATE TABLE public.projects(id text PRIMARY KEY,status text,is_public boolean);
`;

test("real bootstrap/seed is atomic, idempotent and runtime permissions preserve fixture ownership", async () => {
  const url = new URL(
    process.env.SOUNDKIT_TEST_DATABASE_URL ?? "http://missing"
  );
  assert.ok(
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname),
    "Disposable database test requires explicit local fixture URL"
  );
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  const require = createRequire(
      new URL("../packages/db/package.json", import.meta.url)
    ),
    { Client } = require("pg"),
    id = randomUUID().replaceAll("-", ""),
    database = `staging_test_${id}`,
    role = `staging_role_${id}`,
    admin = new Client({ connectionString: url.href }),
    testUrl = new URL(url.href);
  let client, runtime, contender;
  const options = {
    appRole: role,
    schemaSha256: createHash("sha256")
      .update(publicSchemaBaseline(schema))
      .digest("hex"),
    schemaSql: schema,
    sourceCommit: "a".repeat(40),
    target: "rocktownlabs/soundkit/staging",
  };
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    await admin.query(
      `CREATE ROLE "${role}" INHERIT IN ROLE pg_read_all_data,pg_write_all_data`
    );
    testUrl.pathname = `/${database}`;
    client = new Client({ connectionString: testUrl.href });
    contender = new Client({ connectionString: testUrl.href });
    await client.connect();
    await contender.connect();
    await contender.query("BEGIN");
    await contender.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('soundkit-staging-bootstrap-v1',0))"
    );
    await assert.rejects(
      bootstrapStaging({ ...options, client }),
      /Another staging bootstrap/u
    );
    await contender.query("ROLLBACK");
    await client.query("CREATE TABLE public.unexpected(id text)");
    await assert.rejects(
      bootstrapStaging({ ...options, client }),
      /empty database/u
    );
    assert.equal(
      (
        await client.query(
          "SELECT to_regnamespace('soundkit_analytics') AS name"
        )
      ).rows[0].name,
      null
    );
    await client.query("DROP TABLE public.unexpected");
    assert.equal(
      (await bootstrapStaging({ ...options, client })).alreadyInitialized,
      false
    );
    assert.equal(
      (await bootstrapStaging({ ...options, client })).alreadyInitialized,
      true
    );
    runtime = new Client({ connectionString: testUrl.href });
    await runtime.connect();
    await runtime.query(`SET ROLE "${role}"`);
    assert.equal(
      (
        await runtime.query(
          "SELECT has_schema_privilege(current_user,'public','CREATE') AS allowed"
        )
      ).rows[0].allowed,
      false
    );
    const seed = {
      client: runtime,
      mediaBucket: "soundkit-media-staging",
      passwords: {
        artist: "a".repeat(40),
        collaborator: "c".repeat(40),
        fan: "f".repeat(40),
      },
      target: options.target,
    };
    await seedStaging(seed);
    await runtime.query(
      "UPDATE public.user_profiles SET display_name='Edited fixture fan' WHERE user_id='staging-fixture-v1-fan'"
    );
    // Reproduce the old fixture shape, then verify a rerun repairs only its
    // workspace and preview fields while retaining credentials/catalog IDs.
    await runtime.query("UPDATE public.tracks SET organization_id=NULL");
    await runtime.query(
      "UPDATE public.track_assets SET asset_kind='master',metadata=NULL,source_asset_id=NULL WHERE purpose='preview'"
    );
    await seedStaging(seed);
    const preserved = await runtime.query(
      "SELECT display_name FROM public.user_profiles WHERE user_id='staging-fixture-v1-fan'"
    );
    assert.equal(preserved.rows[0].display_name, "Edited fixture fan");
    const rows = await runtime.query(
      "SELECT t.organization_id,m.organization_id AS membership,a.primary_organization_id FROM public.tracks t JOIN public.member m ON m.user_id=t.owner_user_id JOIN public.artist_profiles a ON a.user_id=t.owner_user_id"
    );
    assert.equal(rows.rows.length, 3);
    assert.ok(
      rows.rows.every(
        (row) =>
          row.organization_id === row.membership &&
          row.organization_id === row.primary_organization_id
      )
    );
    const assets = await runtime.query(
      "SELECT * FROM public.track_assets WHERE track_id='staging-fixture-v1-track-paid' ORDER BY purpose"
    );
    assert.equal(assets.rows.length, 2);
    const preview = assets.rows.find((row) => row.purpose === "preview");
    assert.equal(preview.asset_kind, "variant_audio");
    assert.equal(preview.metadata.variant, "preview_30s");
    assert.equal(
      preview.source_asset_id,
      "staging-fixture-v1-track-paid-master"
    );
    assert.equal(
      assets.rows.filter((row) => row.asset_kind === "master").length,
      1
    );
    assert.equal(
      (await runtime.query('SELECT count(*)::int AS count FROM public."user"'))
        .rows[0].count,
      3
    );
    assert.ok(
      (
        await runtime.query(
          "SELECT count(*)::int AS count FROM soundkit_analytics.events"
        )
      ).rows[0].count > 0
    );
  } finally {
    await runtime?.end();
    await contender?.end();
    await client?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`DROP ROLE IF EXISTS "${role}"`);
    await admin.end();
  }
});
