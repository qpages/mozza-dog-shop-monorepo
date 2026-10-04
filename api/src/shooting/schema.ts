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

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

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
    name: text("name").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shootings_shot_on_idx").on(table.shotOn),
    check("shootings_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const owners = pgTable(
  "owners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    dogNames: text("dog_names").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("owners_email_idx").on(table.email),
    check("owners_email_lower", sql`${table.email} = lower(${table.email})`),
  ],
);

export const shootingOwners = pgTable(
  "shooting_owners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shootingId: uuid("shooting_id")
      .notNull()
      .references(() => shootings.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("shooting_owners_shooting_owner_idx").on(
      table.shootingId,
      table.ownerId,
    ),
    index("shooting_owners_owner_id_idx").on(table.ownerId),
  ],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shootingOwnerId: uuid("shooting_owner_id")
      .notNull()
      .references(() => shootingOwners.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    thumbnailKey: text("thumbnail_key"),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("photos_shooting_owner_id_idx").on(table.shootingOwnerId),
    uniqueIndex("photos_shooting_owner_sort_order_idx").on(
      table.shootingOwnerId,
      table.sortOrder,
    ),
    uniqueIndex("photos_object_key_idx").on(table.objectKey),
    uniqueIndex("photos_thumbnail_key_idx").on(table.thumbnailKey),
    check(
      "photos_thumbnail_key_shape",
      sql`${table.thumbnailKey} IS NULL OR ${table.thumbnailKey} = ${table.objectKey} || '.thumb.webp'`,
    ),
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

export const OWNER_EVENT_TYPES = [
  "shooting_opened",
  "zip_downloaded",
  "photo_downloaded",
  "participation_claimed",
  "instagram_message",
] as const;

export const ownerEvents = pgTable(
  "owner_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    type: text("type").notNull(),
    shootingId: uuid("shooting_id").references(() => shootings.id, {
      onDelete: "set null",
    }),
    photoId: uuid("photo_id").references(() => photos.id, {
      onDelete: "set null",
    }),
    visitorId: uuid("visitor_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("owner_events_email_idx").on(table.email),
    index("owner_events_type_idx").on(table.type),
    index("owner_events_created_at_idx").on(table.createdAt.desc()),
    index("owner_events_shooting_id_idx").on(table.shootingId),
    index("owner_events_visitor_id_idx").on(table.visitorId),
    // One gallery open per browser and shooting — refreshes must not flood Activité.
    uniqueIndex("owner_events_open_once_idx")
      .on(table.visitorId, table.shootingId)
      .where(
        sql`${table.type} = 'shooting_opened' AND ${table.shootingId} IS NOT NULL`,
      ),
    check(
      "owner_events_email_lower",
      sql`${table.email} = lower(${table.email})`,
    ),
    check(
      "owner_events_type",
      sql`${table.type} in ('shooting_opened','zip_downloaded','photo_downloaded','participation_claimed','instagram_message')`,
    ),
  ],
);

export const shootingsRelations = relations(shootings, ({ many }) => ({
  shootingOwners: many(shootingOwners),
}));

export const ownersRelations = relations(owners, ({ many }) => ({
  shootingOwners: many(shootingOwners),
}));

export const shootingOwnersRelations = relations(
  shootingOwners,
  ({ one, many }) => ({
    shooting: one(shootings, {
      fields: [shootingOwners.shootingId],
      references: [shootings.id],
    }),
    owner: one(owners, {
      fields: [shootingOwners.ownerId],
      references: [owners.id],
    }),
    photos: many(photos),
  }),
);

export const photosRelations = relations(photos, ({ one }) => ({
  shootingOwner: one(shootingOwners, {
    fields: [photos.shootingOwnerId],
    references: [shootingOwners.id],
  }),
}));

export const ownerEventsRelations = relations(ownerEvents, ({ one }) => ({
  shooting: one(shootings, {
    fields: [ownerEvents.shootingId],
    references: [shootings.id],
  }),
  photo: one(photos, {
    fields: [ownerEvents.photoId],
    references: [photos.id],
  }),
}));
