import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";

export const VISITOR_COOKIE = "visitor";

const YEAR_SECONDS = 60 * 60 * 24 * 365;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const visitorIds = new WeakMap<FastifyRequest, string>();

export function parseVisitorId(value: string | undefined): string | null {
  if (!value || !UUID_RE.test(value)) return null;
  return value.toLowerCase();
}

export function resolveVisitorId(raw: string | undefined): {
  id: string;
  fresh: boolean;
} {
  const existing = parseVisitorId(raw);
  if (existing) return { id: existing, fresh: false };
  return { id: randomUUID(), fresh: true };
}

export function visitorCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: YEAR_SECONDS,
    secure,
  };
}

export function bindVisitor(
  request: FastifyRequest,
  reply: FastifyReply,
  secure: boolean,
): string {
  const cached = visitorIds.get(request);
  if (cached) return cached;

  const { id, fresh } = resolveVisitorId(request.cookies[VISITOR_COOKIE]);
  if (fresh) {
    reply.setCookie(VISITOR_COOKIE, id, visitorCookieOptions(secure));
  }
  visitorIds.set(request, id);
  return id;
}
