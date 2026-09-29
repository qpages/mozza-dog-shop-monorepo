ALTER TABLE "photos" ADD COLUMN "thumbnail_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "photos_thumbnail_key_idx" ON "photos" USING btree ("thumbnail_key");
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_thumbnail_key_shape" CHECK ("thumbnail_key" IS NULL OR "thumbnail_key" = "object_key" || '.thumb.webp');
