import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import env from "@fastify/env";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { fileURLToPath } from "node:url";
import { adminRoutes, requireAdmin } from "./admin/http.js";
import dbPlugin from "./db.js";
import { shootingAdminRoutes, shootingRoutes } from "./shooting/http.js";
import storagePlugin from "./storage.js";
import "./types.js";

const envSchema = {
  type: "object",
  required: ["DATABASE_URL", "JWT_SECRET"],
  additionalProperties: false,
  properties: {
    DATABASE_URL: { type: "string", minLength: 1 },
    JWT_SECRET: { type: "string", minLength: 16 },
    WEB_ORIGIN: { type: "string", default: "http://localhost:4321" },
    PORT: { type: "integer", default: 8787 },
    HOST: { type: "string", default: "0.0.0.0" },
    NODE_ENV: { type: "string", default: "development" },
    R2_ACCOUNT_ID: { type: "string", default: "" },
    R2_ACCESS_KEY_ID: { type: "string", default: "" },
    R2_SECRET_ACCESS_KEY: { type: "string", default: "" },
    R2_BUCKET: { type: "string", default: "" },
  },
};

export async function buildApp() {
  const app = Fastify({
    logger: {
      redact: {
        paths: [
          "password",
          "req.body.password",
          "ADMIN_PASSWORD",
          "config.ADMIN_PASSWORD",
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
        ],
        censor: "[redacted]",
      },
    },
  });

  await app.register(env, {
    schema: envSchema,
    dotenv: {
      path: fileURLToPath(new URL("../.env", import.meta.url)),
    },
  });
  await app.register(sensible);
  await app.register(cors, {
    origin: app.config.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "DELETE"],
  });
  await app.register(cookie);
  await app.register(jwt, {
    secret: app.config.JWT_SECRET,
    sign: { expiresIn: "7d" },
    cookie: {
      cookieName: "token",
      signed: false,
    },
  });
  await app.register(rateLimit, { global: false });
  await app.register(dbPlugin);
  await app.register(storagePlugin);

  app.get("/health", async () => ({ ok: true }));
  await app.register(shootingRoutes);
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(
    async (admin) => {
      await admin.register(requireAdmin);
      await admin.register(shootingAdminRoutes);
    },
    { prefix: "/admin" },
  );

  return app;
}
