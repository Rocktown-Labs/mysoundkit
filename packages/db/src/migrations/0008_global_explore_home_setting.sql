CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "platform_settings" ("key", "value")
VALUES (
	'discovery',
	'{"defaultExploreRegion":"us-arkansas","defaultExploreRegionType":"north-america","useGlobalExploreHome":true}'::jsonb
)
ON CONFLICT ("key") DO NOTHING;
