import { ZipArchive } from "archiver";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { withDetails } from "../logger.js";
import { contentDispositionAttachment } from "../storage.js";
import { requireStorage } from "../types.js";
import { normalizeEmail } from "./email.js";
import { changeOwnerEmail } from "./owner-email.js";
import { drizzleOwnerEmailPort } from "./owner-email-store.js";
import {
  photoDownloadFilename,
  photoTitle,
  shootingArchiveFilename,
} from "./photo-naming.js";
import {
  storedObjectKeys,
  ThumbnailError,
  writeThumbnail,
} from "./thumbnail.js";
import {
  MAX_PHOTO_BYTES,
  owners,
  PHOTO_CLAIM_STATUSES,
  PHOTO_CONTENT_TYPES,
  photoClaims,
  photos,
  shootingOwners,
  shootings,
} from "./schema.js";

const PHOTO_UPLOAD_REQUIRES_DOG_MESSAGE =
  "Ajoute au moins un chien à ce participant avant d'importer des photos.";

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

  app.post<{
    Body: {
      email: string;
      firstName: string;
      lastName: string;
      dogName: string;
      shootingDate: string;
    };
  }>(
    "/photo-claims",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "email",
            "firstName",
            "lastName",
            "dogName",
            "shootingDate",
          ],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email", maxLength: 320 },
            firstName: { type: "string", minLength: 1, maxLength: 80 },
            lastName: { type: "string", minLength: 1, maxLength: 80 },
            dogName: { type: "string", minLength: 1, maxLength: 80 },
            shootingDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!allowPhotoClaimIp(request.ip)) {
        return reply.code(429).send({
          statusCode: 429,
          error: "Too Many Requests",
          code: "rate_limited",
          message: "Trop de tentatives. Réessaie plus tard.",
        });
      }

      const email = normalizeEmail(request.body.email);
      const firstName = trimClaimPersonField(request.body.firstName);
      const lastName = trimClaimPersonField(request.body.lastName);
      const dogName = trimClaimPersonField(request.body.dogName);
      const shootingDate = parseClaimShootingDate(request.body.shootingDate);
      if (!firstName || !lastName || !dogName) {
        throw app.httpErrors.badRequest("invalid claim identity");
      }
      if (!shootingDate) {
        throw app.httpErrors.badRequest("invalid shooting date");
      }

      const duplicate = await app.db.query.photoClaims.findFirst({
        where: and(
          eq(photoClaims.email, email),
          eq(photoClaims.shootingDate, shootingDate),
        ),
      });
      if (duplicate) {
        return reply.code(409).send({
          statusCode: 409,
          error: "Conflict",
          code: "already_reported",
          message: "Ce shooting a déjà été signalé pour cet e-mail.",
        });
      }

      const [openRow] = await app.db
        .select({ value: count() })
        .from(photoClaims)
        .where(
          and(eq(photoClaims.email, email), eq(photoClaims.status, "open")),
        );
      if ((openRow?.value ?? 0) >= MAX_OPEN_CLAIMS_PER_EMAIL) {
        return reply.code(409).send({
          statusCode: 409,
          error: "Conflict",
          code: "too_many_pending",
          message:
            "Vous avez déjà des signalements en attente. L’équipe s’en occupe.",
        });
      }

      const since = new Date(Date.now() - CLAIM_CREATE_WINDOW_MS);
      const [recentRow] = await app.db
        .select({ value: count() })
        .from(photoClaims)
        .where(
          and(eq(photoClaims.email, email), gte(photoClaims.createdAt, since)),
        );
      if ((recentRow?.value ?? 0) >= MAX_CLAIMS_PER_EMAIL_PER_DAY) {
        return reply.code(429).send({
          statusCode: 429,
          error: "Too Many Requests",
          code: "too_many_recent",
          message: "Trop de signalements récemment. Réessayez plus tard.",
        });
      }

      try {
        const [created] = await app.db
          .insert(photoClaims)
          .values({ email, firstName, lastName, dogName, shootingDate })
          .returning();
        return { claim: serializePhotoClaim(created) };
      } catch (error) {
        if (isUniqueViolation(error)) {
          return reply.code(409).send({
            statusCode: 409,
            error: "Conflict",
            code: "already_reported",
            message: "Ce shooting a déjà été signalé pour cet e-mail.",
          });
        }
        throw error;
      }
    },
  );
};

export const shootingAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { status?: string; limit?: string } }>(
    "/photo-claims",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: {
              type: "string",
              enum: ["all", ...PHOTO_CLAIM_STATUSES],
            },
            limit: { type: "string", pattern: "^([1-9]|[1-9][0-9]|100)$" },
          },
        },
      },
    },
    async (request) => {
      const status = request.query.status ?? "open";
      const limit = request.query.limit
        ? Number(request.query.limit)
        : undefined;
      const statusFilter =
        status === "open" || status === "archived"
          ? eq(photoClaims.status, status)
          : undefined;
      const [totalRow] = await app.db
        .select({ value: count() })
        .from(photoClaims)
        .where(statusFilter);
      const rows = await app.db.query.photoClaims.findMany({
        where: statusFilter,
        orderBy: [desc(photoClaims.createdAt)],
        ...(limit !== undefined ? { limit } : {}),
      });
      return {
        claims: rows.map(serializePhotoClaim),
        total: totalRow?.value ?? 0,
      };
    },
  );

  app.post<{ Params: { claimId: string } }>(
    "/photo-claims/:claimId/archive",
    { schema: { params: uuidParams("claimId") } },
    async (request) => {
      const [claim] = await app.db
        .update(photoClaims)
        .set({ status: "archived", updatedAt: new Date() })
        .where(
          and(
            eq(photoClaims.id, request.params.claimId),
            eq(photoClaims.status, "open"),
          ),
        )
        .returning();
      if (!claim) throw app.httpErrors.notFound("photo claim not found");
      return { claim: serializePhotoClaim(claim) };
    },
  );

  app.post<{ Params: { claimId: string } }>(
    "/photo-claims/:claimId/restore",
    { schema: { params: uuidParams("claimId") } },
    async (request) => {
      const [claim] = await app.db
        .update(photoClaims)
        .set({ status: "open", updatedAt: new Date() })
        .where(
          and(
            eq(photoClaims.id, request.params.claimId),
            eq(photoClaims.status, "archived"),
          ),
        )
        .returning();
      if (!claim) throw app.httpErrors.notFound("photo claim not found");
      return { claim: serializePhotoClaim(claim) };
    },
  );

  app.delete<{ Body: { ids: string[] } }>(
    "/photo-claims",
    {
      schema: {
        body: {
          type: "object",
          required: ["ids"],
          additionalProperties: false,
          properties: {
            ids: {
              type: "array",
              minItems: 1,
              maxItems: 100,
              items: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
    async (request) => {
      const ids = [...new Set(request.body.ids)];
      const deleted = await app.db
        .delete(photoClaims)
        .where(inArray(photoClaims.id, ids))
        .returning({ id: photoClaims.id });
      if (deleted.length === 0) {
        throw app.httpErrors.notFound("photo claim not found");
      }
      return { deleted: deleted.length };
    },
  );

  app.delete<{ Params: { claimId: string } }>(
    "/photo-claims/:claimId",
    { schema: { params: uuidParams("claimId") } },
    async (request, reply) => {
      const [claim] = await app.db
        .delete(photoClaims)
        .where(eq(photoClaims.id, request.params.claimId))
        .returning({ id: photoClaims.id });
      if (!claim) throw app.httpErrors.notFound("photo claim not found");
      return reply.code(204).send();
    },
  );

  app.get("/shootings", async () => {
    const rows = await app.db.query.shootings.findMany({
      orderBy: [desc(shootings.shotOn)],
      with: {
        shootingOwners: {
          orderBy: [desc(shootingOwners.createdAt)],
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
                sheet.photos.map(async (photo, index) => {
                  const { url, thumbUrl } = await signedPhotoUrls(
                    storage,
                    photo,
                  );
                  return {
                    id: photo.id,
                    url,
                    thumbUrl,
                    title: photoTitle({
                      shootingName: shooting.name,
                      dogNames: sheet.owner.dogNames,
                      index,
                    }),
                    byteSize: photo.byteSize,
                    contentType: photo.contentType,
                    uploadedAt: photo.createdAt.toISOString(),
                  };
                }),
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
        sheet.photos.flatMap((photo) => storedObjectKeys(photo)),
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

      const keys = sheet.photos.flatMap((photo) => storedObjectKeys(photo));
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

  app.patch<{
    Params: { shootingId: string; ownerId: string };
    Body: { email: string };
  }>(
    "/shootings/:shootingId/owners/:ownerId",
    {
      schema: {
        params: uuidParams("shootingId", "ownerId"),
        body: {
          type: "object",
          required: ["email"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email", maxLength: 320 },
          },
        },
      },
    },
    async (request) => {
      const result = await changeOwnerEmail(drizzleOwnerEmailPort(app.db), {
        shootingId: request.params.shootingId,
        ownerId: request.params.ownerId,
        email: request.body.email,
      });
      if (result.ok) return { email: result.email };

      switch (result.error) {
        case "invalid-email":
          throw app.httpErrors.badRequest("invalid email");
        case "shooting-missing":
          throw app.httpErrors.notFound("shooting not found");
        case "owner-missing":
          throw app.httpErrors.notFound("owner not found");
        case "archived":
          throw app.httpErrors.conflict("shooting is archived");
        case "taken":
          throw app.httpErrors.conflict("email already used");
      }
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
        throw withDetails(
          app.httpErrors.badRequest("uploaded object was not found"),
          { objectKey },
        );
      }
      if (stored.byteSize !== byteSize || stored.contentType !== contentType) {
        throw withDetails(
          app.httpErrors.badRequest(
            "uploaded object does not match the declared file",
          ),
          {
            objectKey,
            declaredByteSize: byteSize,
            storedByteSize: stored.byteSize,
            declaredContentType: contentType,
            storedContentType: stored.contentType ?? null,
          },
        );
      }

      let thumbnailKey: string;
      try {
        thumbnailKey = await writeThumbnail(storage, objectKey);
      } catch (error) {
        if (error instanceof ThumbnailError) {
          throw withDetails(app.httpErrors.badRequest(error.message), {
            objectKey,
          });
        }
        throw error;
      }

      const id = objectKey.slice(prefix.length);
      const [photo] = await app.db
        .insert(photos)
        .values({
          id,
          shootingOwnerId: sheet.id,
          objectKey,
          thumbnailKey,
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
      await storage.removeMany(
        targets.flatMap((photo) => storedObjectKeys(photo)),
      );
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

function serializePhotoClaim(claim: typeof photoClaims.$inferSelect) {
  return {
    id: claim.id,
    email: claim.email,
    firstName: claim.firstName,
    lastName: claim.lastName,
    dogName: claim.dogName,
    shootingDate: claim.shootingDate,
    status: claim.status,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
}

function trimClaimPersonField(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 80 ? trimmed : null;
}

const MAX_OPEN_CLAIMS_PER_EMAIL = 3;
const MAX_CLAIMS_PER_EMAIL_PER_DAY = 5;
const CLAIM_CREATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CLAIM_ATTEMPTS_PER_IP = 10;
const CLAIM_IP_WINDOW_MS = 60 * 60 * 1000;

const photoClaimAttemptsByIp = new Map<string, number[]>();

function allowPhotoClaimIp(ip: string) {
  const now = Date.now();
  const recent = (photoClaimAttemptsByIp.get(ip) ?? []).filter(
    (at) => now - at < CLAIM_IP_WINDOW_MS,
  );
  if (recent.length >= MAX_CLAIM_ATTEMPTS_PER_IP) {
    photoClaimAttemptsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  photoClaimAttemptsByIp.set(ip, recent);
  return true;
}

/** YYYY-MM-DD calendar date, not future, not older than 2 years. */
function parseClaimShootingDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  if (utc > todayUtc) return null;
  const minUtc = new Date(todayUtc);
  minUtc.setUTCFullYear(minUtc.getUTCFullYear() - 2);
  if (utc < minUtc) return null;
  return value;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
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

async function signedPhotoUrls(
  storage: {
    presignGet: (
      key: string,
      options?: { downloadName?: string },
    ) => Promise<string>;
  } | null,
  photo: { objectKey: string; thumbnailKey: string | null },
  downloadName?: string,
) {
  if (!storage) return { url: "", thumbUrl: "", downloadUrl: "" };
  const [url, downloadUrl, thumbSigned] = await Promise.all([
    storage.presignGet(photo.objectKey),
    downloadName
      ? storage.presignGet(photo.objectKey, { downloadName })
      : Promise.resolve(""),
    photo.thumbnailKey
      ? storage.presignGet(photo.thumbnailKey)
      : Promise.resolve(""),
  ]);
  return { url, downloadUrl, thumbUrl: thumbSigned || url };
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
        thumbUrl: string;
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
      const { url, thumbUrl, downloadUrl } = await signedPhotoUrls(
        storage,
        photo,
        downloadName,
      );
      listed.push({
        id: photo.id,
        url,
        thumbUrl,
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
