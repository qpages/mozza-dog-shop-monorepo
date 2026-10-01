ALTER TABLE "photos" ADD COLUMN "sort_order" integer;
--> statement-breakpoint
UPDATE "photos" AS p
SET "sort_order" = ranked.rn
FROM (
  SELECT
    "id",
    (row_number() OVER (
      PARTITION BY "shooting_owner_id"
      ORDER BY "created_at" DESC
    ) - 1)::integer AS rn
  FROM "photos"
) AS ranked
WHERE p."id" = ranked."id";
--> statement-breakpoint
ALTER TABLE "photos" ALTER COLUMN "sort_order" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "photos_shooting_owner_sort_order_idx" ON "photos" USING btree ("shooting_owner_id","sort_order");
