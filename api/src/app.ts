import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import env from "@fastify/env";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { fileURLToPath } from "node:url";
import { adminRoutes, protectedAdminRoutes } from "./admin/http.js";
import dbPlugin from "./db.js";
import {
  loggerOptions,
  RequestLogController,
  resolveLogLevel,
} from "./logger.js";
import notifyPlugin from "./notify.js";
import { createCorsOriginChecker } from "./origins.js";
import { shootingRoutes } from "./shooting/http.js";
import storagePlugin from "./storage.js";
import "./types.js";

const envSchema = {
  type: "object",
  required: ["DATABASE_URL", "JWT_SECRET"],
  additionalProperties: false,
  properties: {
    DATABASE_URL: { type: "string", minLength: 1 },
    JWT_SECRET: { type: "string", minLength: 16 },
    // Comma-separated origins. Prod: one exact site URL. Dev: localhost is enough;
    // private LAN origins (192.168.x, 10.x, 127.x, …) are also accepted when NODE_ENV≠production.
    WEB_ORIGIN: { type: "string", default: "http://localhost:4321" },
    PORT: { type: "integer", default: 8787 },
    HOST: { type: "string", default: "0.0.0.0" },
    NODE_ENV: { type: "string", default: "development" },
    LOG_LEVEL: {
      type: "string",
      default: "info",
      enum: ["fatal", "error", "warn", "info", "debug", "trace"],
    },
    R2_ENDPOINT: { type: "string", default: "" },
    R2_REGION: { type: "string", default: "auto" },
    R2_FORCE_PATH_STYLE: { type: "boolean", default: false },
    R2_ACCOUNT_ID: { type: "string", default: "" },
    R2_ACCESS_KEY_ID: { type: "string", default: "" },
    R2_SECRET_ACCESS_KEY: { type: "string", default: "" },
    R2_BUCKET: { type: "string", default: "" },
    SLACK_WEBHOOK_URL: { type: "string", default: "" },
  },
};

export async function buildApp() {
  const app = Fastify({
    // Coolify's proxy is the only public ingress. Trust private peers so
    // request.ip is the client from X-Forwarded-For, not the proxy container.
    trustProxy: "loopback, linklocal, uniquelocal",
    logger: loggerOptions,
    logController: new RequestLogController(),
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  await app.register(env, {
    schema: envSchema,
    dotenv: {
      path: fileURLToPath(new URL("../.env", import.meta.url)),
    },
  });
  app.log.level = resolveLogLevel(app.config.LOG_LEVEL);
  await app.register(sensible);
  await app.register(cors, {
    origin: createCorsOriginChecker(app.config.WEB_ORIGIN, app.config.NODE_ENV),
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
    exposedHeaders: ["x-request-id"],
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
  await app.register(notifyPlugin);

  app.get("/health", async () => ({ ok: true }));
  await app.register(shootingRoutes);
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(protectedAdminRoutes, { prefix: "/admin" });

  return app;
}
