import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { normalizeEmail } from "../shooting/email.js";
import { shootingAdminRoutes } from "../shooting/http.js";
import { verifyPassword } from "./password.js";
import { admins } from "./schema.js";

const sessionCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { email: string; password: string } }>(
    "/session",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email", maxLength: 320 },
            password: { type: "string", minLength: 8, maxLength: 200 },
          },
        },
      },
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      const email = normalizeEmail(request.body.email);
      const admin = await app.db.query.admins.findFirst({
        where: eq(admins.email, email),
      });
      const valid = admin
        ? await verifyPassword(request.body.password, admin.passwordHash)
        : false;
      if (!admin || !valid) {
        throw app.httpErrors.unauthorized("invalid credentials");
      }

      const token = app.jwt.sign({ sub: admin.id, email: admin.email });
      reply.setCookie("token", token, {
        ...sessionCookie,
        secure: app.config.NODE_ENV === "production",
      });
      return { email: admin.email };
    },
  );

  app.delete("/session", async (_request, reply) => {
    reply.clearCookie("token", { path: "/" });
    return { ok: true };
  });
};

export const protectedAdminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request) => {
    try {
      await request.jwtVerify();
    } catch {
      throw app.httpErrors.unauthorized();
    }
  });

  app.get("/session", async (request) => ({ email: request.user.email }));
  await app.register(shootingAdminRoutes);
};
