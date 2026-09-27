CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_lower" CHECK ("admins"."email" = lower("admins"."email"))
);
--> statement-breakpoint
CREATE TABLE "dogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shooting_id" uuid NOT NULL,
	"owner_email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dogs_email_lower" CHECK ("dogs"."owner_email" = lower("dogs"."owner_email")),
	CONSTRAINT "dogs_name_not_blank" CHECK (length(btrim("dogs"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dog_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photos_byte_size" CHECK ("photos"."byte_size" > 0 AND "photos"."byte_size" <= 10485760),
	CONSTRAINT "photos_content_type" CHECK ("photos"."content_type" in ('image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
CREATE TABLE "shootings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shot_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dogs" ADD CONSTRAINT "dogs_shooting_id_shootings_id_fk" FOREIGN KEY ("shooting_id") REFERENCES "public"."shootings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_dog_id_dogs_id_fk" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admins_email_idx" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "dogs_owner_email_idx" ON "dogs" USING btree ("owner_email");--> statement-breakpoint
CREATE UNIQUE INDEX "dogs_shooting_owner_name_idx" ON "dogs" USING btree ("shooting_id","owner_email","name");--> statement-breakpoint
CREATE INDEX "photos_dog_id_idx" ON "photos" USING btree ("dog_id");--> statement-breakpoint
CREATE UNIQUE INDEX "photos_object_key_idx" ON "photos" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "shootings_shot_on_idx" ON "shootings" USING btree ("shot_on");