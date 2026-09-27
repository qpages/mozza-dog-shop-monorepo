import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const shootings = pgTable(
  "shootings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shotOn: date("shot_on", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("shootings_shot_on_idx").on(table.shotOn)],
);

export const dogs = pgTable(
  "dogs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shootingId: uuid("shooting_id")
      .notNull()
      .references(() => shootings.id, { onDelete: "cascade" }),
    ownerEmail: text("owner_email").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("dogs_owner_email_idx").on(table.ownerEmail),
    uniqueIndex("dogs_shooting_owner_name_idx").on(
      table.shootingId,
      table.ownerEmail,
      table.name,
    ),
    check(
      "dogs_email_lower",
      sql`${table.ownerEmail} = lower(${table.ownerEmail})`,
    ),
    check("dogs_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dogId: uuid("dog_id")
      .notNull()
      .references(() => dogs.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("photos_dog_id_idx").on(table.dogId),
    uniqueIndex("photos_object_key_idx").on(table.objectKey),
    check(
      "photos_byte_size",
      sql`${table.byteSize} > 0 AND ${table.byteSize} <= ${sql.raw(String(MAX_PHOTO_BYTES))}`,
    ),
    check(
      "photos_content_type",
      sql`${table.contentType} in ('image/jpeg', 'image/png', 'image/webp')`,
    ),
  ],
);

export const shootingsRelations = relations(shootings, ({ many }) => ({
  dogs: many(dogs),
}));

export const dogsRelations = relations(dogs, ({ one, many }) => ({
  shooting: one(shootings, {
    fields: [dogs.shootingId],
    references: [shootings.id],
  }),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  dog: one(dogs, {
    fields: [photos.dogId],
    references: [dogs.id],
  }),
}));
