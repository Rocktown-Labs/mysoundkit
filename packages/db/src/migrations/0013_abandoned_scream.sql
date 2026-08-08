ALTER TABLE "videos" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "videos_slug_idx" ON "videos" USING btree ("slug");