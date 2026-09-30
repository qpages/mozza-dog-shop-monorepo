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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("photos_shooting_owner_id_idx").on(table.shootingOwnerId),
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

/** Visitor says they attended a shooting but their email has no photos. */
export const PHOTO_CLAIM_STATUSES = ["open", "archived"] as const;
export type PhotoClaimStatus = (typeof PHOTO_CLAIM_STATUSES)[number];

export const photoClaims = pgTable(
  "photo_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dogName: text("dog_name").notNull(),
    shootingDate: date("shooting_date", { mode: "string" }).notNull(),
    status: text("status", { enum: PHOTO_CLAIM_STATUSES })
      .notNull()
      .default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("photo_claims_email_idx").on(table.email),
    index("photo_claims_status_idx").on(table.status),
    uniqueIndex("photo_claims_email_date_idx").on(
      table.email,
      table.shootingDate,
    ),
    check(
      "photo_claims_email_lower",
      sql`${table.email} = lower(${table.email})`,
    ),
    check("photo_claims_status", sql`${table.status} in ('open', 'archived')`),
  ],
);
