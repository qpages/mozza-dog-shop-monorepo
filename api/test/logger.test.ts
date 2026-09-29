import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";
import Fastify from "fastify";
import {
  loggerOptions,
  RequestLogController,
  withDetails,
} from "../src/logger.js";

type Line = {
  level: number;
  msg: string;
  reqId?: string;
  req?: { method?: string; url?: string; route?: string };
  res?: { statusCode?: number };
  err?: {
    message?: string;
    stack?: string;
    code?: string;
    validation?: { path?: string; message?: string }[];
    details?: Record<string, string | number | null>;
    authorization?: string;
  };
  responseTime?: number;
};

function capture() {
  const lines: Line[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const row of chunk.toString().split("\n")) {
        if (row) lines.push(JSON.parse(row) as Line);
      }
      callback();
    },
  });
  return { lines, stream };
}

async function build() {
  const logs = capture();
  const app = Fastify({
    logger: { ...loggerOptions, level: "info", stream: logs.stream },
    logController: new RequestLogController(),
  });
  app.get("/health", async () => ({ ok: true }));
  app.get("/ok", async () => ({ ok: true }));
  app.get("/missing", async () => {
    throw Object.assign(new Error("dog not found"), { statusCode: 404 });
  });
  app.get("/reject", async () => {
    const error = Object.assign(new Error("uploaded object was not found"), {
      statusCode: 400,
      authorization: "secret-token",
    });
    throw withDetails(error, { objectKey: "shootings/a/owners/b/photo" });
  });
  app.get("/boom", async () => {
    throw new Error("explode");
  });
  app.post(
    "/photos",
    {
      schema: {
        body: {
          type: "object",
          required: ["byteSize"],
          additionalProperties: false,
          properties: {
            byteSize: { type: "integer", minimum: 1, maximum: 10 },
          },
        },
      },
    },
    async () => ({ ok: true }),
  );
  app.options("/ok", async (_request, reply) => reply.code(204).send());
  await app.ready();
  return { app, lines: logs.lines };
}

function byUrl(lines: Line[], url: string) {
  return lines.filter((line) => line.req?.url === url);
}

test("request logs stay one line, with a level that matches the outcome", async () => {
  const { app, lines } = await build();

  const health = await app.inject({ method: "GET", url: "/health" });
  const ok = await app.inject({ method: "GET", url: "/ok" });
  const missing = await app.inject({ method: "GET", url: "/no-such-route" });
  const notFound = await app.inject({ method: "GET", url: "/missing" });
  const rejected = await app.inject({ method: "GET", url: "/reject" });
  const boom = await app.inject({ method: "GET", url: "/boom" });
  const invalid = await app.inject({
    method: "POST",
    url: "/photos",
    headers: { "content-type": "application/json" },
    payload: { byteSize: 999 },
  });
  const preflight = await app.inject({ method: "OPTIONS", url: "/ok" });

  assert.equal(health.statusCode, 200);
  assert.equal(ok.statusCode, 200);
  assert.equal(missing.statusCode, 404);
  assert.equal(notFound.statusCode, 404);
  assert.equal(rejected.statusCode, 400);
  assert.equal(rejected.json().details, undefined);
  assert.equal(rejected.body.includes("shootings/a"), false);
  assert.equal(boom.statusCode, 500);
  assert.equal(invalid.statusCode, 400);
  assert.equal(preflight.statusCode, 204);

  assert.deepEqual(byUrl(lines, "/health"), []);

  const completed = lines.filter(
    (line) => line.req?.method === "GET" && line.req.url === "/ok",
  );
  assert.equal(completed.length, 1);
  assert.equal(completed[0]?.level, 30);
  assert.equal(completed[0]?.msg, "request completed");
  assert.equal(completed[0]?.req?.route, "/ok");
  assert.equal(typeof completed[0]?.responseTime, "number");
  assert.equal(
    lines.some((line) => line.req?.method === "OPTIONS"),
    false,
  );

  const scanner = byUrl(lines, "/no-such-route");
  assert.equal(scanner.length, 1);
  assert.equal(scanner[0]?.level, 30);
  assert.equal(scanner[0]?.msg, "request completed");
  assert.equal(scanner[0]?.res?.statusCode, 404);
  assert.equal(
    lines.some((line) => line.msg.includes("not found")),
    false,
  );

  const product404 = byUrl(lines, "/missing");
  assert.equal(product404.length, 1);
  assert.equal(product404[0]?.level, 40);
  assert.equal(product404[0]?.msg, "request rejected");
  assert.equal(product404[0]?.err?.message, "dog not found");
  assert.equal(product404[0]?.err?.stack, undefined);

  const upload = byUrl(lines, "/reject");
  assert.equal(upload.length, 1);
  assert.equal(upload[0]?.level, 40);
  assert.equal(upload[0]?.err?.message, "uploaded object was not found");
  assert.equal(
    upload[0]?.err?.details?.objectKey,
    "shootings/a/owners/b/photo",
  );
  assert.equal(JSON.stringify(upload[0]).includes("secret-token"), false);
  assert.equal(upload[0]?.err?.stack, undefined);

  const failed = byUrl(lines, "/boom");
  assert.equal(failed.length, 1);
  assert.equal(failed[0]?.level, 50);
  assert.equal(failed[0]?.msg, "request failed");
  assert.match(failed[0]?.err?.stack ?? "", /explode/);

  const validation = byUrl(lines, "/photos");
  assert.equal(validation.length, 1);
  assert.equal(validation[0]?.level, 40);
  assert.equal(validation[0]?.err?.code, "FST_ERR_VALIDATION");
  assert.equal(validation[0]?.err?.stack, undefined);
  assert.ok(
    validation[0]?.err?.validation?.some((issue) =>
      `${issue.path ?? ""} ${issue.message ?? ""}`.includes("byteSize"),
    ),
  );

  await app.close();
});
