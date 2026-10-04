ALTER TABLE "owner_events" ADD COLUMN "visitor_id" uuid;
--> statement-breakpoint
CREATE INDEX "owner_events_visitor_id_idx" ON "owner_events" USING btree ("visitor_id");
--> statement-breakpoint
DROP INDEX "owner_events_open_once_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "owner_events_open_once_idx" ON "owner_events" USING btree ("visitor_id","shooting_id") WHERE "owner_events"."type" = 'shooting_opened' AND "owner_events"."shooting_id" IS NOT NULL;
