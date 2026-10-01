import { asc, desc } from "drizzle-orm";
import { photos } from "./schema.js";

export const photoListOrder = [
  asc(photos.sortOrder),
  desc(photos.createdAt),
] as const;

export function prependSortOrder(currentMin: number | null): number {
  return currentMin === null ? 0 : currentMin - 1;
}

export function samePhotoSet(ids: string[], existingIds: string[]): boolean {
  if (ids.length !== existingIds.length) return false;
  if (new Set(ids).size !== ids.length) return false;
  const have = new Set(existingIds);
  return ids.every((id) => have.has(id));
}
