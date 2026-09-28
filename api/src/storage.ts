import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import fp from "fastify-plugin";

const PUT_TTL_SECONDS = 10 * 60;
const GET_TTL_SECONDS = 15 * 60;

export type ObjectStorage = {
  bucket: string;
  presignPut: (input: {
    key: string;
    contentType: string;
    byteSize: number;
  }) => Promise<string>;
  presignGet: (
    key: string,
    options?: { downloadName?: string },
  ) => Promise<string>;
  head: (
    key: string,
  ) => Promise<{ byteSize: number; contentType: string | undefined } | null>;
  getStream: (key: string) => Promise<Readable>;
  removeMany: (keys: string[]) => Promise<void>;
};

const DELETE_BATCH_SIZE = 1000;

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("name" in error && error.name === "NotFound") ||
      ("$metadata" in error &&
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404))
  );
}

export default fp(
  async (app) => {
    const {
      R2_ENDPOINT,
      R2_REGION,
      R2_FORCE_PATH_STYLE,
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET,
    } = app.config;
    const endpoint =
      R2_ENDPOINT ||
      (R2_ACCOUNT_ID
        ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : "");
    if (!endpoint || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
      app.decorate("storage", null);
      return;
    }

    const client = new S3Client({
      region: R2_REGION,
      endpoint,
      forcePathStyle: R2_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      // AWS SDK v3 adds a CRC32 checksum header by default, which bakes the
      // checksum of an empty body into presigned PUT URLs and makes S3-compatible
      // stores (R2, Garage, MinIO) reject the real upload with InvalidDigest.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });

    // The browser uploads and reads photos directly from the object store,
    // cross-origin from WEB_ORIGIN. A presigned PUT with a content-type header
    // triggers a CORS preflight, so the bucket must allow that origin or the
    // browser blocks the request. Applying the rules on boot keeps the config
    // in sync with WEB_ORIGIN and survives a store reset (pnpm db:reset).
    try {
      await client.send(
        new PutBucketCorsCommand({
          Bucket: R2_BUCKET,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: [app.config.WEB_ORIGIN],
                AllowedMethods: ["GET", "PUT", "HEAD"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
    } catch (error) {
      app.log.warn({ err: error }, "could not apply bucket CORS rules");
    }

    const storage: ObjectStorage = {
      bucket: R2_BUCKET,
      presignPut: ({ key, contentType, byteSize }) =>
        getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            ContentType: contentType,
            ContentLength: byteSize,
          }),
          { expiresIn: PUT_TTL_SECONDS },
        ),
      presignGet: (key, options) =>
        getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            ...(options?.downloadName
              ? {
                  ResponseContentDisposition: contentDispositionAttachment(
                    options.downloadName,
                  ),
                }
              : {}),
          }),
          { expiresIn: GET_TTL_SECONDS },
        ),
      head: async (key) => {
        try {
          const result = await client.send(
            new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }),
          );
          return {
            byteSize: result.ContentLength ?? 0,
            contentType: result.ContentType,
          };
        } catch (error) {
          if (isNotFound(error)) return null;
          throw error;
        }
      },
      getStream: async (key) => {
        const result = await client.send(
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
        );
        if (!result.Body) {
          throw new Error(`empty object body: ${key}`);
        }
        return result.Body as Readable;
      },
      removeMany: async (keys) => {
        for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
          const chunk = keys.slice(i, i + DELETE_BATCH_SIZE);
          await client.send(
            new DeleteObjectsCommand({
              Bucket: R2_BUCKET,
              Delete: {
                Objects: chunk.map((Key) => ({ Key })),
                Quiet: true,
              },
            }),
          );
        }
      },
    };

    app.decorate("storage", storage);
  },
  { name: "storage" },
);

export function contentDispositionAttachment(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
