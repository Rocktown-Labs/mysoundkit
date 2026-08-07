CREATE TABLE "ai_credit_grants" (
  "amount" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "granted_by_user_id" text,
  "id" text PRIMARY KEY NOT NULL,
  "reason" text,
  "source" text DEFAULT 'admin_grant' NOT NULL,
  "user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_credit_grants" ADD CONSTRAINT "ai_credit_grants_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_credit_grants" ADD CONSTRAINT "ai_credit_grants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ai_credit_grants_user_id_idx" ON "ai_credit_grants" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "ai_credit_grants_created_at_idx" ON "ai_credit_grants" USING btree ("created_at");
