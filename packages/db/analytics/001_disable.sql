-- Non-destructive rollback: retain captured events and stop new captures.
BEGIN;
SET LOCAL lock_timeout = '3s';
DO $$ DECLARE target text; BEGIN
  FOREACH target IN ARRAY ARRAY['user','subscription','transactions','payment_refunds','orders','purchases','track_assets','tracks','videos','projects'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS soundkit_analytics_capture ON public.%I',target);
  END LOOP;
END $$;
UPDATE soundkit_analytics.version SET fingerprint='disabled:' || fingerprint WHERE version=1;
COMMIT;
