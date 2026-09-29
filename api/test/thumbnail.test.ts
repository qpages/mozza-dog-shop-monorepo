import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import sharp from "sharp";
import {
  renderThumbnail,
  storedObjectKeys,
  THUMBNAIL_CONTENT_TYPE,
  THUMBNAIL_MAX_EDGE,
  thumbnailKeyFor,
  ThumbnailError,
  writeThumbnail,
} from "../src/shooting/thumbnail.js";

test("thumbnail key is the original key plus the webp suffix", () => {
  const objectKey = "shootings/a/owners/b/c";
  assert.equal(thumbnailKeyFor(objectKey), `${objectKey}.thumb.webp`);
  assert.deepEqual(storedObjectKeys({ objectKey, thumbnailKey: null }), [
    objectKey,
  ]);
  assert.deepEqual(
    storedObjectKeys({
      objectKey,
      thumbnailKey: thumbnailKeyFor(objectKey),
    }),
    [objectKey, thumbnailKeyFor(objectKey)],
  );
});

test("renderThumbnail fits inside the edge and keeps a small image", async () => {
  const large = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: 180, g: 40, b: 40 },
    },
  })
    .jpeg()
    .toBuffer();
  const largeMeta = await sharp(await renderThumbnail(large)).metadata();
  assert.equal(largeMeta.format, "webp");
  assert.equal(largeMeta.width, THUMBNAIL_MAX_EDGE);
  assert.equal(largeMeta.height, 320);

  const small = await sharp({
    create: {
      width: 40,
      height: 20,
      channels: 3,
      background: "white",
    },
  })
    .png()
    .toBuffer();
  const smallMeta = await sharp(await renderThumbnail(small)).metadata();
  assert.equal(smallMeta.width, 40);
  assert.equal(smallMeta.height, 20);
});

test("renderThumbnail applies EXIF orientation", async () => {
  const oriented = await sharp({
    create: {
      width: 100,
      height: 40,
      channels: 3,
      background: "red",
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const meta = await sharp(await renderThumbnail(oriented)).metadata();
  assert.equal(meta.width, 40);
  assert.equal(meta.height, 100);
});

test("renderThumbnail rejects a buffer that is not an image", async () => {
  await assert.rejects(
    () => renderThumbnail(Buffer.from("not an image")),
    ThumbnailError,
  );
});

test("writeThumbnail stores a webp next to the original", async () => {
  const source = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: "blue",
    },
  })
    .jpeg()
    .toBuffer();
  const puts: { key: string; contentType: string; bytes: number }[] = [];
  const key = await writeThumbnail(
    {
      getStream: () => Promise.resolve(Readable.from(source)),
      put: (objectKey, body, contentType) => {
        puts.push({ key: objectKey, contentType, bytes: body.length });
        return Promise.resolve();
      },
    },
    "shootings/a/owners/b/c",
  );

  assert.equal(key, "shootings/a/owners/b/c.thumb.webp");
  assert.equal(puts.length, 1);
  assert.equal(puts[0]?.key, key);
  assert.equal(puts[0]?.contentType, THUMBNAIL_CONTENT_TYPE);
  assert.ok((puts[0]?.bytes ?? 0) > 0);
  assert.ok((puts[0]?.bytes ?? 0) < 100_000);
});

test("writeThumbnail stops when the object exceeds the size cap", async () => {
  await assert.rejects(
    () =>
      writeThumbnail(
        {
          getStream: () => Promise.resolve(Readable.from(Buffer.alloc(32))),
          put: () => Promise.resolve(),
        },
        "shootings/a/owners/b/c",
        8,
      ),
    (error: unknown) =>
      error instanceof ThumbnailError &&
      error.message === "uploaded object exceeds the size limit",
  );
});
