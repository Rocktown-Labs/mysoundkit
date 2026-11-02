-- DuckDB, on files obtained through an authorized internal reader.
-- The archive holds 30 days; all business decisions remain ledger-backed.
WITH unique_events AS (
  SELECT * EXCLUDE (delivery_copy) FROM (
    SELECT *, row_number() OVER (PARTITION BY event_id ORDER BY occurred_at) AS delivery_copy
    FROM read_ndjson_auto('events/v1/**/*.json')
    WHERE environment='production' AND schema_version=1
  ) WHERE delivery_copy=1
)
SELECT currency,
  sum(CASE event_type WHEN 'payment_succeeded' THEN amount_cents
    WHEN 'payment_refunded' THEN -amount_cents ELSE 0 END) AS net_settled_cents
FROM unique_events WHERE event_type IN ('payment_succeeded','payment_refunded')
GROUP BY currency;
