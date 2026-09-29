import { ZipArchive } from "archiver";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { contentDispositionAttachment } from "../storage.js";
import { requireStorage } from "../types.js";
import { normalizeEmail } from "./email.js";
import {
  photoDownloadFilename,
  photoTitle,
  shootingArchiveFilename,
} from "./photo-naming.js";
import {
  MAX_PHOTO_BYTES,
  owners,
  PHOTO_CONTENT_TYPES,
  photos,
  shootingOwners,
  shootings,
} from "./schema.js";

const PHOTO_UPLOAD_REQUIRES_DOG_MESSAGE =
  "Ajoute au moins un chien à ce maître avant d'importer des photos.";

const contentTypeSchema = { type: "string", enum: [...PHOTO_CONTENT_TYPES] };
const dogNamesSchema = {
  type: "array",
  minItems: 1,
  maxItems: 8,
  items: { type: "string", minLength: 1, maxLength: 80 },
};

const optionalDogNamesSchema = {
  type: "array",
  maxItems: 8,
  items: { type: "string", minLength: 1, maxLength: 80 },
};

type PhotoRow = typeof photos.$inferSelect;
type SheetRow = typeof shootingOwners.$inferSelect & {
  photos: PhotoRow[];
  shooting: typeof shootings.$inferSelect;
  owner: typeof owners.$inferSelect;
};

export const shootingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { email: string } }>(
    "/photos",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["email"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email", maxLength: 320 },
          },
        },
      },
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const email = normalizeEmail(request.query.email);
      const owner = await app.db.query.owners.findFirst({
        where: eq(owners.email, email),
        with: {
          shootingOwners: {
            with: {
              shooting: true,
              photos: { orderBy: [desc(photos.createdAt)] },
            },
          },
        },
      });
      const rows =
        owner?.shootingOwners.map((sheet) => ({
          ...sheet,
          owner,
        })) ?? [];

      const hasPhotos = rows.some((row) => row.photos.length > 0);
      if (hasPhotos && !app.storage) {
        throw app.httpErrors.serviceUnavailable(
          "object storage is not configured",
        );
      }

      return { email, shootings: await groupByShooting(app.storage, rows) };
    },
  );

  app.get<{ Querystring: { email: string; shooting: string } }>(
    "/photos/archive",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["email", "shooting"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email", maxLength: 320 },
            shooting: { type: "string", format: "uuid" },
          },
        },
      },
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const email = normalizeEmail(request.query.email);
      const shootingId = request.query.shooting;
      const owner = await app.db.query.owners.findFirst({
        where: eq(owners.email, email),
        with: {
          shootingOwners: {
            where: eq(shootingOwners.shootingId, shootingId),
            with: {
              shooting: true,
              photos: { orderBy: [desc(photos.createdAt)] },
            },
          },
        },
      });
      const sheet = owner?.shootingOwners[0];
      if (!sheet || sheet.shooting.archivedAt || sheet.photos.length === 0) {
        throw app.httpErrors.notFound("photos not found");
      }

      const storage = requireStorage(app);
      const zipName = shootingArchiveFilename(sheet.shooting.name);
      const archive = new ZipArchive({ store: true });
      archive.on("warning", (error) => {
        request.log.warn({ err: error }, "zip archive warning");
      });
      archive.on("error", (error) => {
        request.log.error({ err: error }, "zip archive failed");
        archive.destroy();
      });

      void (async () => {
        try {
          for (const [index, photo] of sheet.photos.entries()) {
            const body = await storage.getStream(photo.objectKey);
            archive.append(body, {
              name: photoDownloadFilename({
                shootingName: sheet.shooting.name,
                dogNames: owner.dogNames,
                index,
                contentType: photo.contentType,
              }),
            });
          }
          await archive.finalize();
        } catch (error) {
          request.log.error({ err: error }, "zip archive failed");
          archive.destroy(error instanceof Error ? error : undefined);
        }
      })();

      return reply
        .header("Content-Type", "application/zip")
        .header("Cache-Control", "no-store")
        .header("Content-Disposition", contentDispositionAttachment(zipName))
        .send(archive);
    },
  );
};

export const shootingAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/shootings", async () => {
    const rows = await app.db.query.shootings.findMany({
      orderBy: [desc(shootings.shotOn)],
      with: {
        shootingOwners: {
          with: {
            photos: { orderBy: [desc(photos.createdAt)] },
            owner: true,
          },
        },
      },
    });
    const storage = app.storage;
    return {
      shootings: await Promise.all(
        rows.map(async (shooting) => ({
          id: shooting.id,
          shotOn: shooting.shotOn,
          name: shooting.name,
          archived: shooting.archivedAt !== null,
          owners: await Promise.all(
            shooting.shootingOwners.map(async (sheet) => ({
              id: sheet.owner.id,
              email: sheet.owner.email,
              photoCount: sheet.photos.length,
              dogs: sheet.owner.dogNames,
              photos: await Promise.all(
                sheet.photos.map(async (photo, index) => ({
                  id: photo.id,
                  url: storage ? await storage.presignGet(photo.objectKey) : "",
                  title: photoTitle({
                    shootingName: shooting.name,
                    dogNames: sheet.owner.dogNames,
                    index,
                  }),
                  byteSize: photo.byteSize,
                  contentType: photo.contentType,
                  uploadedAt: photo.createdAt.toISOString(),
                })),
              ),
            })),
          ),
        })),
      ),
    };
  });

  app.post<{ Body: { shotOn: string; name: string } }>(
    "/shootings",
    {
      schema: {
        body: {
          type: "object",
          required: ["shotOn", "name"],
          additionalProperties: false,
          properties: {
            shotOn: { type: "string", format: "date" },
            name: { type: "string", minLength: 1, maxLength: 80 },
          },
        },
      },
    },
    async (request, reply) => {
      const [shooting] = await app.db
        .insert(shootings)
        .values({
          shotOn: request.body.shotOn,
          name: request.body.name.trim(),
        })
        .returning({
          id: shootings.id,
          shotOn: shootings.shotOn,
          name: shootings.name,
        });
      return reply.code(201).send(shooting);
    },
  );

  app.patch<{
    Params: { shootingId: string };
    Body: { shotOn: string; name: string };
  }>(
    "/shootings/:shootingId",
    {
      schema: {
        params: uuidParams("shootingId"),
        body: {
          type: "object",
          required: ["shotOn", "name"],
          additionalProperties: false,
          properties: {
            shotOn: { type: "string", format: "date" },
            name: { type: "string", minLength: 1, maxLength: 80 },
          },
        },
      },
    },
    async (request) => {
      const [shooting] = await app.db
        .update(shootings)
        .set({
          shotOn: request.body.shotOn,
          name: request.body.name.trim(),
        })
        .where(eq(shootings.id, request.params.shootingId))
        .returning({
          id: shootings.id,
          shotOn: shootings.shotOn,
          name: shootings.name,
        });
      if (!shooting) throw app.httpErrors.notFound("shooting not found");
      return shooting;
    },
  );

  app.delete<{ Params: { shootingId: string } }>(
    "/shootings/:shootingId",
    { schema: { params: uuidParams("shootingId") } },
    async (request, reply) => {
      const shooting = await app.db.query.shootings.findFirst({
        where: eq(shootings.id, request.params.shootingId),
        with: {
          shootingOwners: { with: { photos: true } },
        },
      });
      if (!shooting) throw app.httpErrors.notFound("shooting not found");

      const keys = shooting.shootingOwners.flatMap((sheet) =>
        sheet.photos.map((photo) => photo.objectKey),
      );
      // Remove from the object store first: if it fails we keep the database
      // rows so the photos stay listed instead of pointing at missing objects.
      if (keys.length > 0) {
        await requireStorage(app).removeMany(keys);
      }

      await app.db
        .delete(shootings)
        .where(eq(shootings.id, request.params.shootingId));
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { shootingId: string } }>(
    "/shootings/:shootingId/archive",
    { schema: { params: uuidParams("shootingId") } },
    async (request) => {
      const [shooting] = await app.db
        .update(shootings)
        .set({ archivedAt: new Date() })
        .where(eq(shootings.id, request.params.shootingId))
        .returning({ id: shootings.id, archivedAt: shootings.archivedAt });
      if (!shooting) throw app.httpErrors.notFound("shooting not found");
      return { id: shooting.id, archived: true };
    },
  );

  app.post<{ Params: { shootingId: string } }>(
    "/shootings/:shootingId/restore",
    { schema: { params: uuidParams("shootingId") } },
    async (request) => {
      const [shooting] = await app.db
        .update(shootings)
        .set({ archivedAt: null })
        .where(eq(shootings.id, request.params.shootingId))
        .returning({ id: shootings.id });
      if (!shooting) throw app.httpErrors.notFound("shooting not found");
      return { id: shooting.id, archived: false };
    },
  );

  app.get<{ Querystring: { q?: string } }>(
    "/owners",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string", maxLength: 320 },
          },
        },
      },
    },
    async (request) => {
      const q = request.query.q?.trim().toLowerCase() ?? "";
      const rows = await app.db
        .select({
          id: owners.id,
          email: owners.email,
          dogNames: owners.dogNames,
        })
        .from(owners)
        .where(
          q
            ? or(
                ilike(owners.email, likeContains(q)),
                sql`exists (
                  select 1 from unnest(${owners.dogNames}) as dog_name
                  where dog_name ilike ${likeContains(q)}
                )`,
              )
            : undefined,
        )
        .orderBy(q ? asc(owners.email) : desc(owners.createdAt))
        .limit(8);

      return {
        owners: rows.map((row) => ({
          id: row.id,
          email: row.email,
          dogs: row.dogNames,
        })),
      };
    },
  );

  app.post<{
    Params: { shootingId: string };
    Body: { email: string; names?: string[] };
  }>(
    "/shootings/:shootingId/owners",
    {
      schema: {
        params: uuidParams("shootingId"),
        body: {
          type: "object",
          required: ["email"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email", maxLength: 320 },
            names: optionalDogNamesSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const shooting = await app.db.query.shootings.findFirst({
        where: eq(shootings.id, request.params.shootingId),
      });
      if (!shooting) throw app.httpErrors.notFound("shooting not found");
      if (shooting.archivedAt) {
        throw app.httpErrors.conflict("shooting is archived");
      }

      const email = normalizeEmail(request.body.email);
      const incoming = uniqueNames(request.body.names ?? []);
      const result = await app.db.transaction(async (tx) => {
        const existingOwner = await tx.query.owners.findFirst({
          where: eq(owners.email, email),
        });

        if (!existingOwner) {
          const [owner] = await tx
            .insert(owners)
            .values({ email, dogNames: incoming })
            .returning({ id: owners.id });
          await tx.insert(shootingOwners).values({
            shootingId: shooting.id,
            ownerId: owner.id,
          });
          return { added: incoming, skipped: [] as string[], linked: true };
        }

        const existingSheet = await tx.query.shootingOwners.findFirst({
          where: and(
            eq(shootingOwners.shootingId, shooting.id),
            eq(shootingOwners.ownerId, existingOwner.id),
          ),
        });
        const merged = mergeDogNames(existingOwner.dogNames, incoming);
        if (merged.added.length > 0) {
          await tx
            .update(owners)
            .set({ dogNames: merged.names })
            .where(eq(owners.id, existingOwner.id));
        }
        if (!existingSheet) {
          await tx.insert(shootingOwners).values({
            shootingId: shooting.id,
            ownerId: existingOwner.id,
          });
        }

        return {
          added: merged.added,
          skipped: merged.skipped,
          linked: !existingSheet,
        };
      });

      if (result.added.length === 0 && !result.linked) {
        throw app.httpErrors.conflict(
          incoming.length === 0
            ? "owner already on this shooting"
            : "dog already exists for this owner",
        );
      }
      return reply.code(201).send({
        added: result.added,
        skipped: result.skipped,
      });
    },
  );

  app.delete<{ Params: { shootingId: string; ownerId: string } }>(
    "/shootings/:shootingId/owners/:ownerId",
    { schema: { params: uuidParams("shootingId", "ownerId") } },
    async (request, reply) => {
      const shooting = await app.db.query.shootings.findFirst({
        where: eq(shootings.id, request.params.shootingId),
      });
      if (!shooting) throw app.httpErrors.notFound("shooting not found");
      if (shooting.archivedAt) {
        throw app.httpErrors.conflict("shooting is archived");
      }

      const sheet = await app.db.query.shootingOwners.findFirst({
        where: and(
          eq(shootingOwners.shootingId, shooting.id),
          eq(shootingOwners.ownerId, request.params.ownerId),
        ),
        with: { photos: true },
      });
      if (!sheet) throw app.httpErrors.notFound("owner not found");

      const keys = sheet.photos.map((photo) => photo.objectKey);
      // Remove from the object store first: if it fails we keep the database
      // rows so the photos stay listed instead of pointing at missing objects.
      if (keys.length > 0) {
        await requireStorage(app).removeMany(keys);
      }

      await app.db
        .delete(shootingOwners)
        .where(eq(shootingOwners.id, sheet.id));
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { ownerId: string }; Body: { names: string[] } }>(
    "/owners/:ownerId/dogs",
    {
      schema: {
        params: uuidParams("ownerId"),
        body: {
          type: "object",
          required: ["names"],
          additionalProperties: false,
          properties: { names: dogNamesSchema },
        },
      },
    },
    async (request, reply) => {
      const owner = await findOwner(app, request.params.ownerId);
      const merged = mergeDogNames(
        owner.dogNames,
        uniqueNames(request.body.names),
      );
      if (merged.added.length === 0) {
        throw app.httpErrors.conflict("dog already exists for this owner");
      }

      await app.db
        .update(owners)
        .set({ dogNames: merged.names })
        .where(eq(owners.id, owner.id));

      return reply.code(201).send({
        added: merged.added,
        skipped: merged.skipped,
      });
    },
  );

  app.delete<{ Params: { ownerId: string }; Body: { name: string } }>(
    "/owners/:ownerId/dogs",
    {
      schema: {
        params: uuidParams("ownerId"),
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
          },
        },
      },
    },
    async (request) => {
      const owner = await findOwner(app, request.params.ownerId);
      const name = request.body.name.trim();
      if (!owner.dogNames.includes(name)) {
        throw app.httpErrors.notFound("dog not found");
      }

      await app.db
        .update(owners)
        .set({ dogNames: owner.dogNames.filter((dog) => dog !== name) })
        .where(eq(owners.id, owner.id));

      return { removed: name };
    },
  );

  app.post<{
    Params: { shootingId: string; ownerId: string };
    Body: {
      contentType: (typeof PHOTO_CONTENT_TYPES)[number];
      byteSize: number;
    };
  }>(
    "/shootings/:shootingId/owners/:ownerId/photos/presign",
    {
      schema: {
        params: uuidParams("shootingId", "ownerId"),
        body: {
          type: "object",
          required: ["contentType", "byteSize"],
          additionalProperties: false,
          properties: {
            contentType: contentTypeSchema,
            byteSize: {
              type: "integer",
              minimum: 1,
              maximum: MAX_PHOTO_BYTES,
            },
          },
        },
      },
    },
    async (request) => {
      const storage = requireStorage(app);
      const sheet = await findSheetWithOwner(
        app,
        request.params.shootingId,
        request.params.ownerId,
      );
      assertCanUploadPhotos(app, sheet.owner.dogNames);

      const photoId = randomUUID();
      const objectKey = `shootings/${sheet.shootingId}/owners/${sheet.ownerId}/${photoId}`;
      const url = await storage.presignPut({
        key: objectKey,
        contentType: request.body.contentType,
        byteSize: request.body.byteSize,
      });

      return {
        photoId,
        objectKey,
        url,
        contentType: request.body.contentType,
        byteSize: request.body.byteSize,
      };
    },
  );

  app.post<{
    Params: { shootingId: string; ownerId: string };
    Body: {
      objectKey: string;
      contentType: (typeof PHOTO_CONTENT_TYPES)[number];
      byteSize: number;
    };
  }>(
    "/shootings/:shootingId/owners/:ownerId/photos",
    {
      schema: {
        params: uuidParams("shootingId", "ownerId"),
        body: {
          type: "object",
          required: ["objectKey", "contentType", "byteSize"],
          additionalProperties: false,
          properties: {
            objectKey: { type: "string", minLength: 1, maxLength: 512 },
            contentType: contentTypeSchema,
            byteSize: {
              type: "integer",
              minimum: 1,
              maximum: MAX_PHOTO_BYTES,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const storage = requireStorage(app);
      const sheet = await findSheetWithOwner(
        app,
        request.params.shootingId,
        request.params.ownerId,
      );
      assertCanUploadPhotos(app, sheet.owner.dogNames);

      const { objectKey, contentType, byteSize } = request.body;
      const prefix = `shootings/${sheet.shootingId}/owners/${sheet.ownerId}/`;
      if (!objectKey.startsWith(prefix)) {
        throw app.httpErrors.badRequest(
          "object key does not belong to this owner",
        );
      }

      const existing = await app.db.query.photos.findFirst({
        where: and(
          eq(photos.shootingOwnerId, sheet.id),
          eq(photos.objectKey, objectKey),
        ),
      });
      if (existing) {
        return { id: existing.id, objectKey: existing.objectKey };
      }

      const stored = await storage.head(objectKey);
      if (!stored) {
        throw app.httpErrors.badRequest("uploaded object was not found");
      }
      if (stored.byteSize !== byteSize || stored.contentType !== contentType) {
        throw app.httpErrors.badRequest(
          "uploaded object does not match the declared file",
        );
      }

      const id = objectKey.slice(prefix.length);
      const [photo] = await app.db
        .insert(photos)
        .values({
          id,
          shootingOwnerId: sheet.id,
          objectKey,
          contentType,
          byteSize,
        })
        .returning({ id: photos.id, objectKey: photos.objectKey });

      return reply.code(201).send(photo);
    },
  );

  app.delete<{
    Params: { shootingId: string; ownerId: string };
    Body: { ids: string[] };
  }>(
    "/shootings/:shootingId/owners/:ownerId/photos",
    {
      schema: {
        params: uuidParams("shootingId", "ownerId"),
        body: {
          type: "object",
          required: ["ids"],
          additionalProperties: false,
          properties: {
            ids: {
              type: "array",
              minItems: 1,
              maxItems: 500,
              items: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
    async (request) => {
      const storage = requireStorage(app);
      const sheet = await findSheet(
        app,
        request.params.shootingId,
        request.params.ownerId,
      );

      const ids = [...new Set(request.body.ids)];
      const targets = await app.db.query.photos.findMany({
        where: and(
          eq(photos.shootingOwnerId, sheet.id),
          inArray(photos.id, ids),
        ),
      });
      if (targets.length === 0)
        throw app.httpErrors.notFound("no photos found");

      // Remove from the object store first: if it fails we keep the database
      // rows so the photos stay listed instead of pointing at missing objects.
      await storage.removeMany(targets.map((photo) => photo.objectKey));
      await app.db.delete(photos).where(
        and(
          eq(photos.shootingOwnerId, sheet.id),
          inArray(
            photos.id,
            targets.map((photo) => photo.id),
          ),
        ),
      );

      return { deleted: targets.length };
    },
  );
};

function likeContains(value: string) {
  return `%${value.replace(/[%_\\]/g, "\\$&")}%`;
}

function uuidParams(...names: string[]) {
  return {
    type: "object",
    required: names,
    properties: Object.fromEntries(
      names.map((name) => [name, { type: "string", format: "uuid" }]),
    ),
  };
}

function uniqueNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()))];
}

function mergeDogNames(existing: string[], incoming: string[]) {
  const known = new Set(existing);
  const added: string[] = [];
  const skipped: string[] = [];
  for (const name of incoming) {
    if (known.has(name)) {
      skipped.push(name);
      continue;
    }
    known.add(name);
    added.push(name);
  }
  return { names: [...known], added, skipped };
}

async function findOwner(app: FastifyInstance, ownerId: string) {
  const owner = await app.db.query.owners.findFirst({
    where: eq(owners.id, ownerId),
  });
  if (!owner) throw app.httpErrors.notFound("owner not found");
  return owner;
}

async function findSheet(
  app: FastifyInstance,
  shootingId: string,
  ownerId: string,
) {
  const sheet = await app.db.query.shootingOwners.findFirst({
    where: and(
      eq(shootingOwners.shootingId, shootingId),
      eq(shootingOwners.ownerId, ownerId),
    ),
  });
  if (!sheet) throw app.httpErrors.notFound("owner not found");
  return sheet;
}

async function findSheetWithOwner(
  app: FastifyInstance,
  shootingId: string,
  ownerId: string,
) {
  const sheet = await app.db.query.shootingOwners.findFirst({
    where: and(
      eq(shootingOwners.shootingId, shootingId),
      eq(shootingOwners.ownerId, ownerId),
    ),
    with: { owner: true },
  });
  if (!sheet) throw app.httpErrors.notFound("owner not found");
  return sheet;
}

function assertCanUploadPhotos(app: FastifyInstance, dogNames: string[]) {
  if (dogNames.length === 0) {
    throw app.httpErrors.badRequest(PHOTO_UPLOAD_REQUIRES_DOG_MESSAGE);
  }
}

async function groupByShooting(
  storage: {
    presignGet: (
      key: string,
      options?: { downloadName?: string },
    ) => Promise<string>;
  } | null,
  rows: SheetRow[],
) {
  const byShooting = new Map<
    string,
    {
      id: string;
      shotOn: string;
      name: string;
      dogs: string[];
      photos: {
        id: string;
        url: string;
        downloadUrl: string;
        title: string;
        byteSize: number;
        contentType: string;
        uploadedAt: string;
      }[];
    }
  >();

  for (const sheet of rows) {
    if (sheet.shooting.archivedAt) continue;
    const listed = [];
    for (const [index, photo] of sheet.photos.entries()) {
      const naming = {
        shootingName: sheet.shooting.name,
        dogNames: sheet.owner.dogNames,
        index,
      };
      const downloadName = photoDownloadFilename({
        ...naming,
        contentType: photo.contentType,
      });
      const [url, downloadUrl] = storage
        ? await Promise.all([
            storage.presignGet(photo.objectKey),
            storage.presignGet(photo.objectKey, { downloadName }),
          ])
        : ["", ""];
      listed.push({
        id: photo.id,
        url,
        downloadUrl,
        title: photoTitle(naming),
        byteSize: photo.byteSize,
        contentType: photo.contentType,
        uploadedAt: photo.createdAt.toISOString(),
      });
    }

    byShooting.set(sheet.shooting.id, {
      id: sheet.shooting.id,
      shotOn: sheet.shooting.shotOn,
      name: sheet.shooting.name,
      dogs: sheet.owner.dogNames,
      photos: listed,
    });
  }

  return [...byShooting.values()].sort((a, b) =>
    b.shotOn.localeCompare(a.shotOn),
  );
}
