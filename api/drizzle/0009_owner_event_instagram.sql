ALTER TABLE "owner_events" DROP CONSTRAINT "owner_events_type";
--> statement-breakpoint
ALTER TABLE "owner_events" ADD CONSTRAINT "owner_events_type" CHECK ("owner_events"."type" in ('shooting_opened','zip_downloaded','photo_downloaded','participation_claimed','instagram_message'));
