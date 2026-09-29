import { and, eq } from "drizzle-orm";
import type { Database } from "../db.js";
import type {
  EmailAssignment,
  OwnerEmailPort,
  OwnerParticipation,
} from "./owner-email.js";
import { owners, shootingOwners, shootings } from "./schema.js";

export function drizzleOwnerEmailPort(db: Database): OwnerEmailPort {
  return {
    async load(shootingId, ownerId): Promise<OwnerParticipation> {
      const shooting = await db.query.shootings.findFirst({
        where: eq(shootings.id, shootingId),
        columns: { archivedAt: true },
      });
      if (!shooting) return { status: "shooting-missing" };
      if (shooting.archivedAt) return { status: "archived" };

      const sheet = await db.query.shootingOwners.findFirst({
        where: and(
          eq(shootingOwners.shootingId, shootingId),
          eq(shootingOwners.ownerId, ownerId),
        ),
        columns: { id: true },
        with: { owner: { columns: { email: true } } },
      });
      if (!sheet) return { status: "owner-missing" };
      return { status: "active", email: sheet.owner.email };
    },

    async assign(ownerId, email): Promise<EmailAssignment> {
      try {
        const updated = await db
          .update(owners)
          .set({ email })
          .where(eq(owners.id, ownerId))
          .returning({ id: owners.id });
        return updated.length === 0 ? "missing" : "saved";
      } catch (error) {
        if (isUniqueViolation(error)) return "taken";
        throw error;
      }
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}
