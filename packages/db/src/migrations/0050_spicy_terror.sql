CREATE TYPE "public"."battle_participation_result" AS ENUM('canceled', 'ducked', 'forfeited', 'loss', 'quit', 'tie', 'win');--> statement-breakpoint
ALTER TYPE "public"."battle_outcome" ADD VALUE 'quit';--> statement-breakpoint
CREATE TABLE "battle_participations" (
	"battle_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_ranked" boolean DEFAULT false NOT NULL,
	"result" "battle_participation_result" NOT NULL,
	"rounds_played" integer DEFAULT 0 NOT NULL,
	"rounds_won" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "battle_stats" ADD COLUMN "ties" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "is_ranked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "winner_user_id" text;--> statement-breakpoint
ALTER TABLE "battle_participations" ADD CONSTRAINT "battle_participations_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_participations" ADD CONSTRAINT "battle_participations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "battle_participations_battle_user_idx" ON "battle_participations" USING btree ("battle_id","user_id");--> statement-breakpoint
CREATE INDEX "battle_participations_user_created_idx" ON "battle_participations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "battle_participations_user_ranked_idx" ON "battle_participations" USING btree ("user_id","is_ranked");--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_winner_user_id_user_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;