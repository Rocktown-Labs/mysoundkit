ALTER TABLE "tips" ADD COLUMN "artist_amount_cents" integer;--> statement-breakpoint
UPDATE "tips" AS tip
SET "artist_amount_cents" = transaction_row."artist_amount_cents"
FROM "transactions" AS transaction_row
WHERE tip."transaction_id" = transaction_row."id";--> statement-breakpoint
ALTER TABLE "tips" ALTER COLUMN "artist_amount_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tips" ADD COLUMN "stripe_transfer_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "tips_stripe_transfer_id_idx" ON "tips" USING btree ("stripe_transfer_id");