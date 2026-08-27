CREATE TYPE "public"."battle_outcome" AS ENUM('canceled', 'ducked', 'forfeited');--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "outcome" "battle_outcome";--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "outcome_reason" text;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "outcome_user_id" text;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_outcome_user_id_user_id_fk" FOREIGN KEY ("outcome_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;