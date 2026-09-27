CREATE TABLE "shooting_owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shooting_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "shooting_owners" ("shooting_id", "owner_id", "created_at")
SELECT sd."shooting_id", d."owner_id", min(sd."created_at")
FROM "shooting_dogs" sd
JOIN "dogs" d ON d."id" = sd."dog_id"
GROUP BY sd."shooting_id", d."owner_id";
--> statement-breakpoint
CREATE UNIQUE INDEX "shooting_owners_shooting_owner_idx" ON "shooting_owners" USING btree ("shooting_id","owner_id");
--> statement-breakpoint
CREATE INDEX "shooting_owners_owner_id_idx" ON "shooting_owners" USING btree ("owner_id");
--> statement-breakpoint
ALTER TABLE "shooting_owners" ADD CONSTRAINT "shooting_owners_shooting_id_shootings_id_fk" FOREIGN KEY ("shooting_id") REFERENCES "public"."shootings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shooting_owners" ADD CONSTRAINT "shooting_owners_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "shooting_owner_id" uuid;
--> statement-breakpoint
UPDATE "photos" p
SET "shooting_owner_id" = so."id"
FROM "shooting_dogs" sd
JOIN "dogs" d ON d."id" = sd."dog_id"
JOIN "shooting_owners" so ON so."shooting_id" = sd."shooting_id" AND so."owner_id" = d."owner_id"
WHERE p."shooting_dog_id" = sd."id";
--> statement-breakpoint
ALTER TABLE "photos" DROP CONSTRAINT "photos_shooting_dog_id_shooting_dogs_id_fk";
--> statement-breakpoint
DROP INDEX "photos_shooting_dog_id_idx";
--> statement-breakpoint
ALTER TABLE "photos" DROP COLUMN "shooting_dog_id";
--> statement-breakpoint
ALTER TABLE "photos" ALTER COLUMN "shooting_owner_id" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX "photos_shooting_owner_id_idx" ON "photos" USING btree ("shooting_owner_id");
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_shooting_owner_id_shooting_owners_id_fk" FOREIGN KEY ("shooting_owner_id") REFERENCES "public"."shooting_owners"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP TABLE "shooting_dogs";
