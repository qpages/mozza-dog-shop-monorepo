ALTER TABLE "owners" ADD COLUMN "dog_names" text[] DEFAULT '{}';
--> statement-breakpoint
UPDATE "owners" o
SET "dog_names" = COALESCE(
  (
    SELECT array_agg(d."name" ORDER BY d."created_at")
    FROM "dogs" d
    WHERE d."owner_id" = o."id"
  ),
  '{}'
);
--> statement-breakpoint
DELETE FROM "shooting_owners" WHERE "owner_id" IN (SELECT "id" FROM "owners" WHERE cardinality("dog_names") = 0);
--> statement-breakpoint
DELETE FROM "owners" WHERE cardinality("dog_names") = 0;
--> statement-breakpoint
ALTER TABLE "owners" ALTER COLUMN "dog_names" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "owners" ALTER COLUMN "dog_names" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_dog_names_not_blank" CHECK (cardinality("dog_names") > 0);
--> statement-breakpoint
DROP TABLE "dogs";
