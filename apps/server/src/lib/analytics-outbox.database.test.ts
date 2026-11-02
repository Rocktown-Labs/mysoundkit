/* eslint-disable unicorn/no-useless-undefined, unicorn/no-await-expression-member, promise/avoid-new, one-var, sort-vars */
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  analyticsOutboxHealth,
  maintainAnalyticsRetention,
  dispatchAnalyticsOutbox,
  eraseAccountAnalytics,
  replayAnalyticsEvent,
} from "./analytics-outbox";
import {
  analyticsRetention,
  reconcileAnalytics,
} from "./analytics-reconciliation";

const url = process.env.SOUNDKIT_TEST_DATABASE_URL;
describe.skipIf(!url || process.env.SOUNDKIT_DISABLE_DB_TESTS === "true")(
  "transactional analytics outbox",
  () => {
    const client = new Client({
        application_name: "soundkit/pr-500",
        connectionString: url,
      }),
      db = drizzle({ client }),
      environment = "pr-500";
    let actor: string;
    beforeAll(async () => {
      if (
        !url ||
        !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
      ) {
        throw new Error(
          "Analytics DDL tests require an isolated local database"
        );
      }
      await client.connect();
      await client.query("SET TIME ZONE 'UTC'");
    });
    beforeEach(async () => {
      await client.query("BEGIN");
      actor = `outbox-500-${crypto.randomUUID()}`;
      await client.query(
        `INSERT INTO public."user"(id,name,email) VALUES($1,'Fixture',$2)`,
        [actor, `${actor}@example.test`]
      );
    });
    afterEach(async () => {
      await client.query("ROLLBACK");
    });
    afterAll(async () => {
      await client.end();
    });

    const payment = async (id = crypto.randomUUID()) => {
      await client.query(
        `INSERT INTO public.transactions(id,amount_cents,artist_amount_cents,platform_fee_cents,currency,transaction_type,buyer_user_id,status)
      VALUES($1,1999,1799,200,'usd','product_purchase',$2,'pending')`,
        [id, actor]
      );
      return id;
    };
    const clearSignup = async () => {
      await client.query(
        "DELETE FROM soundkit_analytics.events WHERE subject_id IN(SELECT id FROM soundkit_analytics.subjects WHERE user_id=$1)",
        [actor]
      );
    };
    const events = async () =>
      (
        await client.query(
          "SELECT * FROM soundkit_analytics.events WHERE environment=$1 ORDER BY occurred_at,id",
          [environment]
        )
      ).rows;

    it("records money only on settlement and once for duplicate/delayed provider updates", async () => {
      await clearSignup();
      const id = await payment();
      expect(await events()).toHaveLength(0);
      await client.query(
        "UPDATE public.transactions SET status='succeeded' WHERE id=$1",
        [id]
      );
      await client.query(
        "UPDATE public.transactions SET status='succeeded' WHERE id=$1",
        [id]
      );
      await client.query(
        "UPDATE public.transactions SET status='pending' WHERE id=$1",
        [id]
      );
      await client.query(
        "UPDATE public.transactions SET status='succeeded' WHERE id=$1",
        [id]
      );
      const recorded = await events();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].properties).toEqual({
        amount_cents: 1999,
        currency: "USD",
        kind: "product_purchase",
      });
      expect(recorded[0].environment).toBe(environment);
    });

    it("rolls the event back with its business mutation", async () => {
      await clearSignup();
      const id = await payment();
      await client.query("SAVEPOINT business_change");
      await client.query(
        "UPDATE public.transactions SET status='succeeded' WHERE id=$1",
        [id]
      );
      expect(await events()).toHaveLength(1);
      await client.query("ROLLBACK TO SAVEPOINT business_change");
      expect(await events()).toHaveLength(0);
      expect(
        (
          await client.query(
            "SELECT status FROM public.transactions WHERE id=$1",
            [id]
          )
        ).rows[0].status
      ).toBe("pending");
    });

    it("retries a failed export, then replays stable IDs without business side effects", async () => {
      const send = vi.fn().mockRejectedValueOnce(new Error("transient")),
        before = (await events())[0].id;
      await dispatchAnalyticsOutbox({ db, environment, stream: { send } });
      expect((await events())[0]).toMatchObject({
        attempts: 1,
        delivered_at: null,
        failure_code: "delivery_failed",
      });
      await client.query(
        "UPDATE soundkit_analytics.events SET available_at=now() WHERE id=$1",
        [before]
      );
      send.mockResolvedValue(undefined);
      expect(
        await dispatchAnalyticsOutbox({ db, environment, stream: { send } })
      ).toMatchObject({ delivered: 1 });
      expect(await replayAnalyticsEvent(before, environment, db)).toBe(true);
      await dispatchAnalyticsOutbox({ db, environment, stream: { send } });
      expect(send.mock.calls.map((call) => call[0][0].event_id)).toEqual([
        before,
        before,
        before,
      ]);
      expect(
        (
          await client.query(
            "SELECT count(*)::int AS n FROM public.transactions WHERE buyer_user_id=$1",
            [actor]
          )
        ).rows[0].n
      ).toBe(0);
    });

    it("does not let a second dispatcher claim an active lease", async () => {
      let release: (() => void) | undefined;
      const blocked = new Promise<void>((resolve) => {
          release = resolve;
        }),
        started = vi.fn();
      const first = dispatchAnalyticsOutbox({
        db,
        environment,
        stream: {
          send: async () => {
            started();
            await blocked;
          },
        },
      });
      await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
      const second = vi.fn();
      expect(
        await dispatchAnalyticsOutbox({
          db,
          environment,
          stream: { send: second },
        })
      ).toMatchObject({ delivered: 0 });
      expect(second).not.toHaveBeenCalled();
      release?.();
      await first;
    });

    it("recovers an expired lease and quarantines repeated delivery failure", async () => {
      await client.query(
        "UPDATE soundkit_analytics.events SET leased_until=now()-interval '1 second',lease_id=gen_random_uuid(),attempts=9 WHERE environment=$1",
        [environment]
      );
      await dispatchAnalyticsOutbox({
        db,
        environment,
        stream: { send: vi.fn().mockRejectedValue(new Error("no")) },
      });
      expect((await events())[0]).toMatchObject({
        attempts: 10,
        failure_code: "delivery_failed",
      });
      expect((await analyticsOutboxHealth(environment, db))?.quarantined).toBe(
        1
      );
    });

    it("does not export another environment or unknown private dimensions", async () => {
      await client.query(
        "UPDATE soundkit_analytics.events SET environment='production' WHERE environment=$1",
        [environment]
      );
      const send = vi.fn();
      await dispatchAnalyticsOutbox({ db, environment, stream: { send } });
      expect(send).not.toHaveBeenCalled();
      await client.query(
        'UPDATE soundkit_analytics.events SET environment=$1,properties=\'{"email":"private@example.test"}\' WHERE subject_id IN(SELECT id FROM soundkit_analytics.subjects WHERE user_id=$2)',
        [environment, actor]
      );
      expect(
        await dispatchAnalyticsOutbox({ db, environment, stream: { send } })
      ).toMatchObject({ rejected: 1 });
      expect(send).not.toHaveBeenCalled();
    });

    it("records an account once per UTC day and unlinks it on erasure with durable exclusion", async () => {
      await client.query("SELECT soundkit_analytics.record_activity($1)", [
        actor,
      ]);
      await client.query("SELECT soundkit_analytics.record_activity($1)", [
        actor,
      ]);
      expect((await events()).map((e) => e.event_type).toSorted()).toEqual([
        "account_active",
        "account_created",
      ]);
      expect((await analyticsRetention(environment, db))[0]).toMatchObject({
        accounts: 1,
      });
      await eraseAccountAnalytics(actor, db);
      await client.query("SELECT soundkit_analytics.record_activity($1)", [
        actor,
      ]);
      expect(await events()).toHaveLength(0);
      expect(
        (
          await client.query(
            "SELECT * FROM soundkit_analytics.activity WHERE user_id=$1",
            [actor]
          )
        ).rows
      ).toHaveLength(0);
      const id = await payment();
      await client.query(
        "UPDATE public.transactions SET status='succeeded' WHERE id=$1",
        [id]
      );
      expect((await events())[0].subject_id).toBeNull();
    });

    it("observes paid-to-access mismatches without repairing or replaying purchases", async () => {
      const id = await payment(),
        order = crypto.randomUUID(),
        item = crypto.randomUUID();
      await client.query(
        "UPDATE public.transactions SET status='succeeded' WHERE id=$1",
        [id]
      );
      await client.query(
        `INSERT INTO public.orders(id,buyer_user_id,transaction_id,status,total_cents) VALUES($1,$2,$3,'paid',1999)`,
        [order, actor, id]
      );
      await client.query(
        `INSERT INTO public.order_items(id,order_id,product_type,title_snapshot,price_snapshot) VALUES($1,$2,'track','Fixture',19.99)`,
        [item, order]
      );
      expect(await reconcileAnalytics(environment, db)).toMatchObject({
        checked_orders: 1,
        missing_digital_access: 1,
        paid_without_settled_transaction: 0,
      });
      await client.query(
        "INSERT INTO public.purchases(id,buyer_user_id,order_item_id) VALUES($1,$2,$3)",
        [crypto.randomUUID(), actor, item]
      );
      expect(await reconcileAnalytics(environment, db)).toMatchObject({
        missing_digital_access: 0,
      });
      await client.query(
        "UPDATE public.orders SET status='failed' WHERE id=$1",
        [order]
      );
      expect(await reconcileAnalytics(environment, db)).toMatchObject({
        access_without_paid_order: 1,
      });
      expect(
        (
          await client.query(
            "SELECT count(*)::int AS n FROM public.purchases WHERE order_item_id=$1",
            [item]
          )
        ).rows[0].n
      ).toBe(1);
    });

    it("deduplicates partial refunds and reports integer net revenue", async () => {
      await clearSignup();
      const id = await payment();
      await client.query(
        "UPDATE public.transactions SET status='succeeded' WHERE id=$1",
        [id]
      );
      for (const amount of [250, 500]) {
        const refund = `re_${crypto.randomUUID()}`;
        for (let repeat = 0; repeat < 2; repeat += 1) {
          await client.query(
            "INSERT INTO public.payment_refunds(id,amount_cents,stripe_refund_id,transaction_id) VALUES($1,$2,$1,$3) ON CONFLICT(stripe_refund_id) DO NOTHING",
            [refund, amount, id]
          );
        }
      }
      const rows = await events();
      expect(rows).toHaveLength(3);
      expect(
        rows.reduce(
          (net, e) =>
            net +
            (e.event_type === "payment_refunded" ? -1 : 1) *
              e.properties.amount_cents,
          0
        )
      ).toBe(1249);
      await eraseAccountAnalytics(actor, db);
      expect((await events()).map((e) => e.subject_id)).toEqual([
        null,
        null,
        null,
      ]);
      expect((await events()).map((e) => e.id).toSorted()).toEqual(
        rows.map((e) => e.id).toSorted()
      );
    });

    it("retains mature cohorts after signup outbox rows expire", async () => {
      const cohort = (
        await client.query(
          "SELECT ((now() AT TIME ZONE 'UTC')::date-30)::text AS day"
        )
      ).rows[0].day;
      await client.query(
        "UPDATE soundkit_analytics.version SET installed_at=now()-interval '31 days'"
      );
      await client.query(
        "UPDATE soundkit_analytics.subjects SET cohort_day=$1 WHERE user_id=$2",
        [cohort, actor]
      );
      await client.query(
        "INSERT INTO soundkit_analytics.activity(user_id,day,environment) VALUES($1,$2::date+30,$3)",
        [actor, cohort, environment]
      );
      await clearSignup();
      expect((await analyticsRetention(environment, db))[0]).toMatchObject({
        accounts: 1,
        day_30: 1,
        day_30_mature: true,
      });
    });

    it("pages reconciliation without dropping orders sharing a timestamp", async () => {
      await client.query(
        `INSERT INTO public.orders(id,buyer_user_id,status,total_cents)
      SELECT $1||':page:'||lpad(n::text,4,'0'),$1,'paid',0 FROM generate_series(1,501) n`,
        [actor]
      );
      const first = await reconcileAnalytics(environment, db);
      expect(first).toMatchObject({ checked_orders: 500, truncated: true });
      const cursor = first?.next_cursor as { createdAt: string; id: string };
      expect(cursor.createdAt).toMatch(/\.\d{6}Z$/u);
      expect(await reconcileAnalytics(environment, db, cursor)).toMatchObject({
        checked_orders: 1,
        next_cursor: null,
        truncated: false,
      });
    });

    it("bounds retention while keeping pending expiry visible before deletion", async () => {
      await client.query(
        "UPDATE soundkit_analytics.events SET occurred_at=now()-interval '31 days' WHERE environment=$1",
        [environment]
      );
      await maintainAnalyticsRetention(db);
      expect((await events())[0]).toMatchObject({ failure_code: "expired" });
      expect((await analyticsOutboxHealth(environment, db))?.quarantined).toBe(
        1
      );
      await client.query(
        "UPDATE soundkit_analytics.events SET occurred_at=now()-interval '91 days' WHERE environment=$1",
        [environment]
      );
      await maintainAnalyticsRetention(db);
      expect(await events()).toHaveLength(0);
    });

    it("keeps observed signup cohorts UTC when the session timezone differs", async () => {
      await client.query("SET TIME ZONE 'America/Chicago'");
      const other = `${actor}-timezone`;
      await client.query(
        `INSERT INTO public."user"(id,name,email) VALUES($1,'Fixture',$2)`,
        [other, `${other}@example.test`]
      );
      const row = await client.query(
        "SELECT s.cohort_day::text AS day,(now() AT TIME ZONE 'UTC')::date::text AS expected FROM soundkit_analytics.subjects s WHERE s.user_id=$1",
        [other]
      );
      expect(row.rows[0].day).toBe(row.rows[0].expected);
    });

    it("allows an injected database without an ambient DATABASE_URL", async () => {
      const prior = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      try {
        expect(
          await dispatchAnalyticsOutbox({
            db,
            environment,
            stream: { send: async () => {} },
          })
        ).toMatchObject({ delivered: 1, skipped: false });
      } finally {
        if (prior === undefined) {
          delete process.env.DATABASE_URL;
        } else {
          process.env.DATABASE_URL = prior;
        }
      }
    });

    it("quarantines legacy charge-based refund records without exporting them", async () => {
      await clearSignup();
      const id = await payment();
      await client.query(
        "UPDATE public.transactions SET status='succeeded' WHERE id=$1",
        [id]
      );
      await client.query(
        "INSERT INTO public.payment_refunds(id,amount_cents,stripe_refund_id,transaction_id) VALUES($1,1999,'ch_legacy',$2)",
        [crypto.randomUUID(), id]
      );
      const send = vi.fn(async (_records: Record<string, unknown>[]) => {});
      await dispatchAnalyticsOutbox({ db, environment, stream: { send } });
      expect(
        send.mock.calls
          .flatMap((call) => call[0])
          .filter((event) => event.event_type === "payment_refunded")
      ).toHaveLength(0);
      expect((await analyticsOutboxHealth(environment, db))?.quarantined).toBe(
        1
      );
    });

    it("quarantines leased rows after unexpected schema drift", async () => {
      // This entire fixture transaction rolls back, including the DDL.
      await client.query(
        "ALTER TABLE soundkit_analytics.events ALTER COLUMN occurred_at DROP NOT NULL"
      );
      await client.query(
        "UPDATE soundkit_analytics.events SET occurred_at=NULL WHERE environment=$1",
        [environment]
      );
      const send = vi.fn(async (_records: Record<string, unknown>[]) => {});
      expect(
        await dispatchAnalyticsOutbox({ db, environment, stream: { send } })
      ).toMatchObject({ delivered: 0, rejected: 1 });
      expect(send).not.toHaveBeenCalled();
      expect((await analyticsOutboxHealth(environment, db))?.quarantined).toBe(
        1
      );
    });

    it("captures provisioned subscription access without claiming paid revenue", async () => {
      await clearSignup();
      const id = crypto.randomUUID();
      await client.query(
        "INSERT INTO public.subscription(id,plan,reference_id,status) VALUES($1,'fixture-plan',$2,'incomplete')",
        [id, actor]
      );
      expect(await events()).toHaveLength(0);
      await client.query(
        "UPDATE public.subscription SET status='trialing' WHERE id=$1",
        [id]
      );
      await client.query(
        "UPDATE public.subscription SET status='active' WHERE id=$1",
        [id]
      );
      expect(await events()).toHaveLength(1);
      expect((await events())[0]).toMatchObject({
        environment,
        event_type: "access_granted",
        properties: { kind: "subscription" },
      });
    });

    it("captures actual ready and publication transitions for tracks, projects and videos", async () => {
      await clearSignup();
      const track = crypto.randomUUID(),
        project = crypto.randomUUID(),
        video = crypto.randomUUID();
      await client.query(
        "INSERT INTO public.tracks(id,owner_user_id,title,slug,is_public) VALUES($1,$2,'Track',$1,false)",
        [track, actor]
      );
      await client.query(
        "INSERT INTO public.track_assets(id,track_id,asset_kind,storage_provider,status) VALUES($1,$2,'master','r2','processing')",
        [crypto.randomUUID(), track]
      );
      await client.query(
        "UPDATE public.track_assets SET status='ready' WHERE track_id=$1",
        [track]
      );
      await client.query(
        "UPDATE public.tracks SET published_at=now(),is_public=true WHERE id=$1",
        [track]
      );
      await client.query(
        "INSERT INTO public.projects(id,owner_user_id,title,slug,project_type,status) VALUES($1,$2,'Project',$1,'album','draft')",
        [project, actor]
      );
      await client.query(
        "UPDATE public.projects SET status='released' WHERE id=$1",
        [project]
      );
      await client.query(
        "INSERT INTO public.videos(id,owner_user_id,title,slug,video_kind,status,is_public,published_at) VALUES($1,$2,'Video',$1,'music_video','ready',true,now())",
        [video, actor]
      );
      const recorded = await events();
      expect(
        recorded.filter((e) => e.event_type === "media_published")
      ).toHaveLength(3);
      expect(
        recorded.filter((e) => e.event_type === "media_ready")
      ).toHaveLength(2);
    });
  }
);
