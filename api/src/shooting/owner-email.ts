import { normalizeEmail } from "./email.js";

const MAX_OWNER_EMAIL_LENGTH = 320;
const OWNER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

declare const ownerEmailBrand: unique symbol;

/** Contact address of an owner. Stored lowercase; it is how they open their gallery. */
export type OwnerEmail = string & { readonly [ownerEmailBrand]: true };

export function parseOwnerEmail(raw: string): OwnerEmail | null {
  const value = normalizeEmail(raw);
  if (value.length === 0 || value.length > MAX_OWNER_EMAIL_LENGTH) return null;
  if (!OWNER_EMAIL_PATTERN.test(value)) return null;
  return value as OwnerEmail;
}

export type OwnerParticipation =
  | { status: "shooting-missing" }
  | { status: "archived" }
  | { status: "owner-missing" }
  | { status: "active"; email: string };

export type EmailAssignment = "saved" | "taken" | "missing";

export type OwnerEmailPort = {
  load(shootingId: string, ownerId: string): Promise<OwnerParticipation>;
  assign(ownerId: string, email: OwnerEmail): Promise<EmailAssignment>;
};

export type ChangeOwnerEmailResult =
  | { ok: true; email: OwnerEmail }
  | {
      ok: false;
      error:
        | "invalid-email"
        | "shooting-missing"
        | "owner-missing"
        | "archived"
        | "taken";
    };

/**
 * Correct the address of an owner who participates in this shooting.
 * The address belongs to the owner, so the correction is visible on every shooting.
 * An archived shooting is frozen. An address already held by someone else is refused:
 * merging two owners is a different decision.
 */
export async function changeOwnerEmail(
  port: OwnerEmailPort,
  command: { shootingId: string; ownerId: string; email: string },
): Promise<ChangeOwnerEmailResult> {
  const email = parseOwnerEmail(command.email);
  if (!email) return { ok: false, error: "invalid-email" };

  const participation = await port.load(command.shootingId, command.ownerId);
  if (participation.status !== "active") {
    return { ok: false, error: participation.status };
  }
  if (participation.email === email) return { ok: true, email };

  const assigned = await port.assign(command.ownerId, email);
  if (assigned === "taken") return { ok: false, error: "taken" };
  if (assigned === "missing") return { ok: false, error: "owner-missing" };
  return { ok: true, email };
}
