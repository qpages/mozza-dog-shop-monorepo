import { and, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import { parseOwnerEmail } from "./owner-email.js";
import { ownerEvents } from "./schema.js";

export type PublicOwnerEvent = {
  email: string;
  type:
    | "shooting_opened"
    | "zip_downloaded"
    | "photo_downloaded"
    | "participation_claimed"
    | "instagram_message";
  shootingId: string | null;
  photoId: string | null;
};

export type RecordedOwnerEvent = PublicOwnerEvent & {
  visitorId: string;
};

export type ParsePublicOwnerEventResult =
  | { ok: true; event: PublicOwnerEvent }
  | {
      ok: false;
      error: "invalid-email" | "invalid-type" | "shooting-required";
    };

export function parsePublicOwnerEvent(input: {
  email: string;
  type: string;
  shootingId?: string;
}): ParsePublicOwnerEventResult {
  const email = parseOwnerEmail(input.email);
  if (!email) return { ok: false, error: "invalid-email" };

  if (input.type === "shooting_opened") {
    if (!input.shootingId) return { ok: false, error: "shooting-required" };
    return {
      ok: true,
      event: {
        email,
        type: "shooting_opened",
        shootingId: input.shootingId,
        photoId: null,
      },
    };
  }

  if (
    input.type === "participation_claimed" ||
    input.type === "instagram_message"
  ) {
    return {
      ok: true,
      event: {
        email,
        type: input.type,
        shootingId: null,
        photoId: null,
      },
    };
  }

  return { ok: false, error: "invalid-type" };
}

export async function recordOwnerEvent(
  db: Database,
  event: RecordedOwnerEvent,
): Promise<"recorded" | "duplicate"> {
  if (event.type === "shooting_opened" && event.shootingId) {
    const existing = await db.query.ownerEvents.findFirst({
      where: and(
        eq(ownerEvents.visitorId, event.visitorId),
        eq(ownerEvents.shootingId, event.shootingId),
        eq(ownerEvents.type, "shooting_opened"),
      ),
      columns: { id: true },
    });
    if (existing) return "duplicate";
  }

  try {
    await db.insert(ownerEvents).values({
      email: event.email,
      visitorId: event.visitorId,
      type: event.type,
      shootingId: event.shootingId,
      photoId: event.photoId,
    });
    return "recorded";
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }
}

export async function recordOwnerEventQuiet(
  db: Database,
  log: { warn: (obj: object, msg: string) => void },
  event: RecordedOwnerEvent,
) {
  try {
    await recordOwnerEvent(db, event);
  } catch (error) {
    log.warn({ err: error }, "owner event recording failed");
  }
}

function isUniqueViolation(error: unknown) {
  return uniqueViolationCode(error) === "23505";
}

function uniqueViolationCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return uniqueViolationCode(error.cause);
  return undefined;
}
