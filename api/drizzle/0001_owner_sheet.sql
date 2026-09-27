ALTER TABLE "shootings" ADD COLUMN "name" text;--> statement-breakpoint
UPDATE "shootings" SET "name" = "shot_on"::text WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "shootings" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shootings" ADD CONSTRAINT "shootings_name_not_blank" CHECK (length(btrim("shootings"."name")) > 0);--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_email_lower" CHECK ("owners"."email" = lower("owners"."email"))
);--> statement-breakpoint
CREATE UNIQUE INDEX "owners_email_idx" ON "owners" USING btree ("email");--> statement-breakpoint
INSERT INTO "owners" ("email")
SELECT DISTINCT "owner_email" FROM "dogs";--> statement-breakpoint
CREATE TABLE "dogs_next" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
INSERT INTO "dogs_next" ("owner_id", "name", "created_at")
SELECT o."id", d."name", min(d."created_at")
FROM "dogs" d
JOIN "owners" o ON o."email" = d."owner_email"
GROUP BY o."id", d."name";--> statement-breakpoint
CREATE UNIQUE INDEX "dogs_owner_name_idx" ON "dogs_next" USING btree ("owner_id","name");--> statement-breakpoint
ALTER TABLE "dogs_next" ADD CONSTRAINT "dogs_next_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "shooting_dogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shooting_id" uuid NOT NULL,
	"dog_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
INSERT INTO "shooting_dogs" ("id", "shooting_id", "dog_id", "created_at")
SELECT d."id", d."shooting_id", n."id", d."created_at"
FROM "dogs" d
JOIN "owners" o ON o."email" = d."owner_email"
JOIN "dogs_next" n ON n."owner_id" = o."id" AND n."name" = d."name";--> statement-breakpoint
CREATE UNIQUE INDEX "shooting_dogs_shooting_dog_idx" ON "shooting_dogs" USING btree ("shooting_id","dog_id");--> statement-breakpoint
CREATE INDEX "shooting_dogs_dog_id_idx" ON "shooting_dogs" USING btree ("dog_id");--> statement-breakpoint
ALTER TABLE "shooting_dogs" ADD CONSTRAINT "shooting_dogs_shooting_id_shootings_id_fk" FOREIGN KEY ("shooting_id") REFERENCES "public"."shootings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shooting_dogs" ADD CONSTRAINT "shooting_dogs_dog_id_dogs_id_fk" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs_next"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" DROP CONSTRAINT "photos_dog_id_dogs_id_fk";--> statement-breakpoint
DROP INDEX "photos_dog_id_idx";--> statement-breakpoint
ALTER TABLE "photos" RENAME COLUMN "dog_id" TO "shooting_dog_id";--> statement-breakpoint
CREATE INDEX "photos_shooting_dog_id_idx" ON "photos" USING btree ("shooting_dog_id");--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_shooting_dog_id_shooting_dogs_id_fk" FOREIGN KEY ("shooting_dog_id") REFERENCES "public"."shooting_dogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TABLE "dogs";--> statement-breakpoint
ALTER TABLE "dogs_next" RENAME TO "dogs";--> statement-breakpoint
ALTER TABLE "dogs" RENAME CONSTRAINT "dogs_next_owner_id_owners_id_fk" TO "dogs_owner_id_owners_id_fk";--> statement-breakpoint
ALTER TABLE "dogs" ADD CONSTRAINT "dogs_name_not_blank" CHECK (length(btrim("dogs"."name")) > 0);
