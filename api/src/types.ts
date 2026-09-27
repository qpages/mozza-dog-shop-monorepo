import type { FastifyInstance } from "fastify";
import type { Database } from "./db.js";
import type { ObjectStorage } from "./storage.js";

export type AppConfig = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  WEB_ORIGIN: string;
  PORT: number;
  HOST: string;
  NODE_ENV: string;
  R2_ENDPOINT: string;
  R2_REGION: string;
  R2_FORCE_PATH_STYLE: boolean;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
};

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    db: Database;
    storage: ObjectStorage | null;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

export function requireStorage(app: FastifyInstance) {
  if (!app.storage) {
    throw app.httpErrors.serviceUnavailable("object storage is not configured");
  }
  return app.storage;
}
