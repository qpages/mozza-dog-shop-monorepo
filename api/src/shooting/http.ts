import { and, desc, eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { requireStorage } from "../types.js";
import { normalizeEmail } from "./email.js";
import {
  dogs,
  MAX_PHOTO_BYTES,
  PHOTO_CONTENT_TYPES,
  photos,
  shootings,
} from "./schema.js";

const contentTypeSchema = { type: "string", enum: [...PHOTO_CONTENT_TYPES] };

type PhotoRow = typeof photos.$inferSelect;
type DogRow = typeof dogs.$inferSelect & {
  photos: PhotoRow[];
  shooting: typeof shootings.$inferSelect;
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
      const rows = await app.db.query.dogs.findMany({
        where: eq(dogs.ownerEmail, email),
        with: {
          shooting: true,
          photos: true,
        },
      });

      const hasPhotos = rows.some((dog) => dog.photos.length > 0);
      if (hasPhotos && !app.storage) {
        throw app.httpErrors.serviceUnavailable(
          "object storage is not configured",
        );
      }

      return { email, shootings: await groupByShooting(app.storage, rows) };
    },
  );
};

export const shootingAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/shootings", async () => {
    const rows = await app.db.query.shootings.findMany({
      orderBy: [desc(shootings.shotOn)],
      with: { dogs: { with: { photos: true } } },
    });
    return {
      shootings: rows.map((shooting) => ({
        id: shooting.id,
        shotOn: shooting.shotOn,
        dogs: shooting.dogs.map((dog) => ({
          id: dog.id,
          name: dog.name,
          ownerEmail: dog.ownerEmail,
          photoCount: dog.photos.length,
        })),
      })),
    };
  });

  app.post<{ Body: { shotOn: string } }>(
    "/shootings",
    {
      schema: {
        body: {
          type: "object",
          required: ["shotOn"],
          additionalProperties: false,
          properties: {
            shotOn: { type: "string", format: "date" },
          },
        },
      },
    },
    async (request, reply) => {
      const [shooting] = await app.db
        .insert(shootings)
        .values({ shotOn: request.body.shotOn })
        .returning({ id: shootings.id, shotOn: shootings.shotOn });
      return reply.code(201).send(shooting);
    },
  );

  app.post<{
    Params: { shootingId: string };
    Body: { email: string; name: string };
  }>(
    "/shootings/:shootingId/dogs",
    {
      schema: {
        params: uuidParams("shootingId"),
        body: {
          type: "object",
          required: ["email", "name"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email", maxLength: 320 },
            name: { type: "string", minLength: 1, maxLength: 80 },
          },
        },
      },
    },
    async (request, reply) => {
      const shooting = await app.db.query.shootings.findFirst({
        where: eq(shootings.id, request.params.shootingId),
      });
      if (!shooting) throw app.httpErrors.notFound("shooting not found");

      const email = normalizeEmail(request.body.email);
      const name = request.body.name.trim();
      try {
        const [dog] = await app.db
          .insert(dogs)
          .values({ shootingId: shooting.id, ownerEmail: email, name })
          .returning({
            id: dogs.id,
            name: dogs.name,
            ownerEmail: dogs.ownerEmail,
          });
        return reply.code(201).send(dog);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw app.httpErrors.conflict("dog already exists for this shooting");
        }
        throw error;
      }
    },
  );

  app.post<{
    Params: { dogId: string };
    Body: {
      contentType: (typeof PHOTO_CONTENT_TYPES)[number];
      byteSize: number;
    };
  }>(
    "/dogs/:dogId/photos/presign",
    {
      schema: {
        params: uuidParams("dogId"),
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
      const dog = await app.db.query.dogs.findFirst({
        where: eq(dogs.id, request.params.dogId),
      });
      if (!dog) throw app.httpErrors.notFound("dog not found");

      const photoId = randomUUID();
      const objectKey = `shootings/${dog.shootingId}/dogs/${dog.id}/${photoId}`;
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
    Params: { dogId: string };
    Body: {
      objectKey: string;
      contentType: (typeof PHOTO_CONTENT_TYPES)[number];
      byteSize: number;
    };
  }>(
    "/dogs/:dogId/photos",
    {
      schema: {
        params: uuidParams("dogId"),
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
      const dog = await app.db.query.dogs.findFirst({
        where: eq(dogs.id, request.params.dogId),
      });
      if (!dog) throw app.httpErrors.notFound("dog not found");

      const { objectKey, contentType, byteSize } = request.body;
      const prefix = `shootings/${dog.shootingId}/dogs/${dog.id}/`;
      if (!objectKey.startsWith(prefix)) {
        throw app.httpErrors.badRequest(
          "object key does not belong to this dog",
        );
      }

      const existing = await app.db.query.photos.findFirst({
        where: and(eq(photos.dogId, dog.id), eq(photos.objectKey, objectKey)),
      });
      if (existing) {
        return { id: existing.id, objectKey: existing.objectKey };
      }

      const stored = await storage.head(objectKey);
      if (stored.byteSize !== byteSize || stored.contentType !== contentType) {
        throw app.httpErrors.badRequest(
          "uploaded object does not match the declared file",
        );
      }

      const id = objectKey.slice(prefix.length);
      const [photo] = await app.db
        .insert(photos)
        .values({ id, dogId: dog.id, objectKey, contentType, byteSize })
        .returning({ id: photos.id, objectKey: photos.objectKey });

      return reply.code(201).send(photo);
    },
  );
};

function uuidParams(name: string) {
  return {
    type: "object",
    required: [name],
    properties: {
      [name]: { type: "string", format: "uuid" },
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    return true;
  }
  if (typeof error === "object" && error !== null && "cause" in error) {
    return isUniqueViolation(error.cause);
  }
  return false;
}

async function groupByShooting(
  storage: { presignGet: (key: string) => Promise<string> } | null,
  rows: DogRow[],
) {
  const byShooting = new Map<
    string,
    {
      id: string;
      shotOn: string;
      dogs: {
        id: string;
        name: string;
        photos: {
          id: string;
          url: string;
          byteSize: number;
          contentType: string;
        }[];
      }[];
    }
  >();

  for (const dog of rows) {
    let shooting = byShooting.get(dog.shooting.id);
    if (!shooting) {
      shooting = { id: dog.shooting.id, shotOn: dog.shooting.shotOn, dogs: [] };
      byShooting.set(dog.shooting.id, shooting);
    }

    const listed = [];
    for (const photo of dog.photos) {
      listed.push({
        id: photo.id,
        url: storage ? await storage.presignGet(photo.objectKey) : "",
        byteSize: photo.byteSize,
        contentType: photo.contentType,
      });
    }

    shooting.dogs.push({ id: dog.id, name: dog.name, photos: listed });
  }

  return [...byShooting.values()].sort((a, b) =>
    b.shotOn.localeCompare(a.shotOn),
  );
}
