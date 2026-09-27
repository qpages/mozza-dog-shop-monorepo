import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
  presignGet: (key: string) => Promise<string>;
  head: (
    key: string,
  ) => Promise<{ byteSize: number; contentType: string | undefined }>;
};

export default fp(
  async (app) => {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } =
      app.config;
    if (
      !R2_ACCOUNT_ID ||
      !R2_ACCESS_KEY_ID ||
      !R2_SECRET_ACCESS_KEY ||
      !R2_BUCKET
    ) {
      app.decorate("storage", null);
      return;
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

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
      presignGet: (key) =>
        getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
          { expiresIn: GET_TTL_SECONDS },
        ),
      head: async (key) => {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }),
        );
        return {
          byteSize: result.ContentLength ?? 0,
          contentType: result.ContentType,
        };
      },
    };

    app.decorate("storage", storage);
  },
  { name: "storage" },
);
