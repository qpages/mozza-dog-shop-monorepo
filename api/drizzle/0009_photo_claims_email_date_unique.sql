DROP INDEX IF EXISTS "photo_claims_open_email_date_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "photo_claims_email_date_idx" ON "photo_claims" USING btree ("email","shooting_date");
