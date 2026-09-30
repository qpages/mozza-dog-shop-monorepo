CREATE TABLE "photo_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"shooting_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_claims_email_lower" CHECK ("email" = lower("email")),
	CONSTRAINT "photo_claims_status" CHECK ("status" in ('open', 'archived'))
);
--> statement-breakpoint
CREATE INDEX "photo_claims_email_idx" ON "photo_claims" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "photo_claims_status_idx" ON "photo_claims" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "photo_claims_open_email_date_idx" ON "photo_claims" USING btree ("email","shooting_date") WHERE "status" = 'open';
