import { and, asc, eq, isNull } from "drizzle-orm";
import { buildApp } from "../app.js";
import { photos } from "./schema.js";
import { writeThumbnail } from "./thumbnail.js";

const app = await buildApp();
let failed = 0;

try {
  await app.ready();
  const storage = app.storage;
  if (!storage) {
    console.error("object storage is not configured");
    failed = 1;
  } else {
    const pending = await app.db.query.photos.findMany({
      where: isNull(photos.thumbnailKey),
      columns: { id: true, objectKey: true },
      orderBy: [asc(photos.createdAt)],
    });
    console.log(`${pending.length} photo(s) without a thumbnail`);

    for (const photo of pending) {
      try {
        const thumbnailKey = await writeThumbnail(storage, photo.objectKey);
        const updated = await app.db
          .update(photos)
          .set({ thumbnailKey })
          .where(and(eq(photos.id, photo.id), isNull(photos.thumbnailKey)))
          .returning({ id: photos.id });
        if (updated.length === 0) {
          console.log(`skipped ${photo.id} (thumbnail already stored)`);
          continue;
        }
        console.log(`thumbnail written ${photo.id}`);
      } catch (error) {
        failed += 1;
        console.error(`thumbnail failed ${photo.id}`, error);
      }
    }
  }
} catch (error) {
  console.error(error);
  failed = 1;
} finally {
  await app.close();
}

process.exit(failed > 0 ? 1 : 0);
