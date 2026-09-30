ALTER TABLE "photo_claims" ADD COLUMN "first_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "photo_claims" ADD COLUMN "last_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "photo_claims" ADD COLUMN "dog_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "photo_claims" ALTER COLUMN "first_name" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "photo_claims" ALTER COLUMN "last_name" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "photo_claims" ALTER COLUMN "dog_name" DROP DEFAULT;
