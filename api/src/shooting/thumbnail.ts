import { Readable } from "node:stream";
import { MAX_PHOTO_BYTES } from "./schema.js";

export const THUMBNAIL_CONTENT_TYPE = "image/webp";
export const THUMBNAIL_MAX_EDGE = 480;
const THUMBNAIL_SUFFIX = ".thumb.webp";
const INPUT_PIXEL_LIMIT = 50_000_000;

export class ThumbnailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThumbnailError";
  }
}

export function thumbnailKeyFor(objectKey: string) {
  return `${objectKey}${THUMBNAIL_SUFFIX}`;
}

export function storedObjectKeys(photo: {
  objectKey: string;
  thumbnailKey: string | null;
}) {
  return photo.thumbnailKey
    ? [photo.objectKey, photo.thumbnailKey]
    : [photo.objectKey];
}

type ThumbnailStorage = {
  getStream: (key: string) => Promise<Readable>;
  put: (key: string, body: Buffer, contentType: string) => Promise<void>;
};

export async function renderThumbnail(input: Buffer) {
  const { default: sharp } = await import("sharp");
  sharp.cache(false);
  sharp.concurrency(1);

  try {
    const output = await sharp(input, {
      failOn: "none",
      limitInputPixels: INPUT_PIXEL_LIMIT,
      animated: false,
    })
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_EDGE,
        height: THUMBNAIL_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    if (output.length < 1) {
      throw new ThumbnailError("uploaded image could not be read");
    }
    return output;
  } catch (error) {
    if (error instanceof ThumbnailError) throw error;
    if (error instanceof Error && /pixel limit/i.test(error.message)) {
      throw new ThumbnailError("uploaded image is too large to process");
    }
    throw new ThumbnailError("uploaded image could not be read");
  }
}

export async function writeThumbnail(
  storage: ThumbnailStorage,
  objectKey: string,
  maxBytes = MAX_PHOTO_BYTES,
) {
  const bytes = await readBounded(await storage.getStream(objectKey), maxBytes);
  const thumbnail = await renderThumbnail(bytes);
  const key = thumbnailKeyFor(objectKey);
  await storage.put(key, thumbnail, THUMBNAIL_CONTENT_TYPE);
  return key;
}

async function readBounded(stream: Readable, maxBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      stream.destroy();
      throw new ThumbnailError("uploaded object exceeds the size limit");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}
