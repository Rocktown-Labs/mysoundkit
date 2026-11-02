-- Issue #500. Explicitly applied, never part of drizzle-kit push.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE SCHEMA soundkit_analytics;
REVOKE ALL ON SCHEMA soundkit_analytics FROM PUBLIC;
CREATE TABLE soundkit_analytics.version (version integer PRIMARY KEY, fingerprint text NOT NULL CHECK(fingerprint ~ '^(disabled:)?[a-f0-9]{64}$'), installed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE soundkit_analytics.exclusions (
  user_id text PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE
);
CREATE TABLE soundkit_analytics.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE REFERENCES public."user"(id) ON DELETE CASCADE,
  cohort_day date NOT NULL,
  registration_environment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_subject_cohort_idx ON soundkit_analytics.subjects(registration_environment,cohort_day);
CREATE TABLE soundkit_analytics.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE CHECK (length(source_key) <= 512),
  event_type text NOT NULL CHECK (event_type IN ('account_created','account_active','payment_succeeded','payment_refunded','order_paid','access_granted','media_ready','media_published')),
  environment text NOT NULL,
  subject_id uuid REFERENCES soundkit_analytics.subjects(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  properties jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(properties) = 'object' AND octet_length(properties::text) <= 1024),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_id uuid,
  leased_until timestamptz,
  delivered_at timestamptz,
  quarantined_at timestamptz,
  failure_code text CHECK (failure_code IN ('delivery_failed','invalid_event','expired'))
);
CREATE INDEX analytics_dispatch_due_idx ON soundkit_analytics.events(environment,available_at) WHERE delivered_at IS NULL AND quarantined_at IS NULL;
CREATE INDEX analytics_events_subject_idx ON soundkit_analytics.events(subject_id,occurred_at);
CREATE INDEX analytics_events_retention_idx ON soundkit_analytics.events(occurred_at);

CREATE FUNCTION soundkit_analytics.environment() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN current_setting('application_name') ~ '^soundkit/(production|pr-[0-9]+|test)$'
    THEN substring(current_setting('application_name') from 10) ELSE 'test' END
$$;
CREATE FUNCTION soundkit_analytics.emit(kind text, source text, actor text, props jsonb DEFAULT '{}') RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE subject uuid;
BEGIN
  IF actor IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('analytics:' || actor,0)); END IF;
  IF actor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM soundkit_analytics.exclusions WHERE user_id=actor) THEN
    INSERT INTO soundkit_analytics.subjects(user_id,cohort_day)
      SELECT id,created_at::date FROM public."user" WHERE id=actor
      ON CONFLICT(user_id) DO NOTHING;
    SELECT id INTO subject FROM soundkit_analytics.subjects WHERE user_id=actor;
  END IF;
  -- Erased accounts may still produce anonymous financial facts, but no activity profile.
  IF kind IN ('account_created','account_active') AND subject IS NULL THEN RETURN; END IF;
  INSERT INTO soundkit_analytics.events(source_key,event_type,environment,subject_id,properties)
    VALUES (source,kind,soundkit_analytics.environment(),subject,props)
    ON CONFLICT(source_key) DO NOTHING;
END $$;

CREATE TABLE soundkit_analytics.activity (
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  day date NOT NULL,
  environment text NOT NULL,
  PRIMARY KEY(user_id,day,environment)
);
CREATE FUNCTION soundkit_analytics.record_activity(actor text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('analytics:' || actor,0));
  INSERT INTO soundkit_analytics.activity(user_id,day,environment)
    SELECT actor,(now() AT TIME ZONE 'UTC')::date,soundkit_analytics.environment()
    WHERE NOT EXISTS (SELECT 1 FROM soundkit_analytics.exclusions WHERE user_id=actor)
    ON CONFLICT DO NOTHING;
  IF FOUND THEN
    PERFORM soundkit_analytics.emit('account_active','active:' || actor || ':' ||
      (now() AT TIME ZONE 'UTC')::date::text || ':' || soundkit_analytics.environment(),actor);
  END IF;
END $$;

CREATE FUNCTION soundkit_analytics.erase_account(actor text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('analytics:' || actor,0));
  INSERT INTO soundkit_analytics.exclusions(user_id) VALUES(actor) ON CONFLICT DO NOTHING;
  DELETE FROM soundkit_analytics.activity WHERE user_id=actor;
  DELETE FROM soundkit_analytics.events WHERE subject_id IN (SELECT id FROM soundkit_analytics.subjects WHERE user_id=actor)
    AND event_type IN ('account_created','account_active');
  DELETE FROM soundkit_analytics.subjects WHERE user_id=actor;
END $$;

CREATE FUNCTION soundkit_analytics.capture() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE actor text; props jsonb; kind text; source text;
BEGIN
  source := TG_TABLE_NAME || ':' || NEW.id;
  CASE TG_TABLE_NAME
  WHEN 'user' THEN
    PERFORM soundkit_analytics.emit('account_created',source,NEW.id);
    UPDATE soundkit_analytics.subjects SET registration_environment=soundkit_analytics.environment(),cohort_day=(now() AT TIME ZONE 'UTC')::date WHERE user_id=NEW.id;
    RETURN NEW;
  WHEN 'subscription' THEN
    IF NEW.status NOT IN ('active','trialing') THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' THEN IF OLD.status IN ('active','trialing') THEN RETURN NEW; END IF; END IF;
    kind := 'access_granted'; actor := NEW.reference_id;
    props := jsonb_build_object('kind','subscription');
  WHEN 'transactions' THEN
    IF NEW.status <> 'succeeded' THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' THEN IF OLD.status='succeeded' THEN RETURN NEW; END IF; END IF;
    kind := 'payment_succeeded'; actor := NEW.buyer_user_id;
    props := jsonb_build_object('amount_cents',NEW.amount_cents,'currency',upper(NEW.currency),'kind',NEW.transaction_type::text);
  WHEN 'payment_refunds' THEN
    kind := 'payment_refunded';
    SELECT buyer_user_id,jsonb_build_object('amount_cents',NEW.amount_cents,'currency',upper(currency),'kind',transaction_type::text)
      INTO actor,props FROM public.transactions WHERE id=NEW.transaction_id;
  WHEN 'orders' THEN
    IF NEW.status <> 'paid' THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' THEN IF OLD.status='paid' THEN RETURN NEW; END IF; END IF;
    kind := 'order_paid'; actor := NEW.buyer_user_id;
    props := jsonb_build_object('amount_cents',NEW.total_cents,'currency',upper(NEW.currency));
  WHEN 'purchases' THEN
    kind := 'access_granted'; actor := NEW.buyer_user_id;
    props := jsonb_build_object('kind',CASE WHEN NEW.track_id IS NOT NULL THEN 'track' WHEN NEW.project_id IS NOT NULL THEN 'project' WHEN NEW.video_id IS NOT NULL THEN 'video' ELSE '' END);
  WHEN 'track_assets' THEN
    IF NEW.status <> 'ready' THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' THEN IF OLD.status='ready' THEN RETURN NEW; END IF; END IF;
    kind := 'media_ready';
    SELECT owner_user_id INTO actor FROM public.tracks WHERE id=NEW.track_id;
    props := jsonb_build_object('kind','audio');
  WHEN 'projects' THEN
    IF NEW.status <> 'released' OR NOT NEW.is_public THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' THEN IF OLD.status='released' AND OLD.is_public THEN RETURN NEW; END IF; END IF;
    kind := 'media_published'; actor := NEW.owner_user_id;
    props := jsonb_build_object('kind','project');
  WHEN 'tracks','videos' THEN
    IF TG_TABLE_NAME='videos' THEN
      IF NEW.status='ready' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'ready') THEN
        PERFORM soundkit_analytics.emit('media_ready',source || ':ready',NEW.owner_user_id,jsonb_build_object('kind','video'));
      END IF;
    END IF;
    IF NEW.published_at IS NULL OR NOT NEW.is_public THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' THEN
      IF OLD.published_at IS NOT NULL AND OLD.is_public THEN RETURN NEW; END IF;
    END IF;
    kind := 'media_published'; actor := NEW.owner_user_id;
    props := jsonb_build_object('kind',CASE TG_TABLE_NAME WHEN 'tracks' THEN 'track' ELSE 'video' END);
  ELSE RETURN NEW;
  END CASE;
  PERFORM soundkit_analytics.emit(kind,source || ':' || kind,actor,props);
  -- The legacy charge.refunded producer stores charge IDs/charge totals in
  -- payment_refunds. They are not confirmed individual Refund facts. Keep
  -- them visible for reconciliation without exporting false refund revenue.
  IF TG_TABLE_NAME='payment_refunds' THEN
    IF left(NEW.stripe_refund_id,3) <> 're_' THEN
      UPDATE soundkit_analytics.events SET quarantined_at=now(),failure_code='invalid_event'
        WHERE source_key=source || ':' || kind;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER soundkit_analytics_capture AFTER INSERT ON public."user" FOR EACH ROW EXECUTE FUNCTION soundkit_analytics.capture();
CREATE TRIGGER soundkit_analytics_capture AFTER INSERT OR UPDATE OF status ON public.transactions FOR EACH ROW EXECUTE FUNCTION soundkit_analytics.capture();
CREATE TRIGGER soundkit_analytics_capture AFTER INSERT OR UPDATE OF status ON public.subscription FOR EACH ROW EXECUTE FUNCTION soundkit_analytics.capture();
CREATE TRIGGER soundkit_analytics_capture AFTER INSERT ON public.payment_refunds FOR EACH ROW EXECUTE FUNCTION soundkit_analytics.capture();
CREATE TRIGGER soundkit_analytics_capture AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION soundkit_analytics.capture();
CREATE TRIGGER soundkit_analytics_capture AFTER INSERT ON public.purchases FOR EACH ROW EXECUTE FUNCTION soundkit_analytics.capture();
CREATE TRIGGER soundkit_analytics_capture AFTER INSERT OR UPDATE OF status ON public.track_assets FOR EACH ROW EXECUTE FUNCTION soundkit_analytics.capture();
CREATE TRIGGER soundkit_analytics_capture AFTER INSERT OR UPDATE OF published_at,is_public ON public.tracks FOR EACH ROW EXECUTE FUNCTION soundkit_analytics.capture();
CREATE TRIGGER soundkit_analytics_capture AFTER INSERT OR UPDATE OF published_at,is_public,status ON public.videos FOR EACH ROW EXECUTE FUNCTION soundkit_analytics.capture();
CREATE TRIGGER soundkit_analytics_capture AFTER INSERT OR UPDATE OF status,is_public ON public.projects FOR EACH ROW EXECUTE FUNCTION soundkit_analytics.capture();
REVOKE ALL ON ALL TABLES IN SCHEMA soundkit_analytics FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA soundkit_analytics FROM PUBLIC;
INSERT INTO soundkit_analytics.version VALUES(1,'__MIGRATION_SHA256__',now());
COMMIT;
