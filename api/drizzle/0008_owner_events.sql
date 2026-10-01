CREATE TABLE "owner_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"type" text NOT NULL,
	"shooting_id" uuid,
	"photo_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_events_email_lower" CHECK ("owner_events"."email" = lower("owner_events"."email")),
	CONSTRAINT "owner_events_type" CHECK ("owner_events"."type" in ('shooting_opened','zip_downloaded','photo_downloaded','participation_claimed'))
);
--> statement-breakpoint
ALTER TABLE "owner_events" ADD CONSTRAINT "owner_events_shooting_id_shootings_id_fk" FOREIGN KEY ("shooting_id") REFERENCES "public"."shootings"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "owner_events" ADD CONSTRAINT "owner_events_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "owner_events_email_idx" ON "owner_events" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "owner_events_type_idx" ON "owner_events" USING btree ("type");
--> statement-breakpoint
CREATE INDEX "owner_events_created_at_idx" ON "owner_events" USING btree ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX "owner_events_shooting_id_idx" ON "owner_events" USING btree ("shooting_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "owner_events_open_once_idx" ON "owner_events" USING btree ("email","shooting_id") WHERE "owner_events"."type" = 'shooting_opened' AND "owner_events"."shooting_id" IS NOT NULL;
