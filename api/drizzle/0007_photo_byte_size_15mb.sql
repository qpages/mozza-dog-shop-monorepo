ALTER TABLE "photos" DROP CONSTRAINT "photos_byte_size";
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_byte_size" CHECK ("photos"."byte_size" > 0 AND "photos"."byte_size" <= 15728640);
