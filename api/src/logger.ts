import {
  LogController,
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;

export type LogLevelName = (typeof LOG_LEVELS)[number];

type LogDetails = Record<string, string | number | boolean | null>;

type LoggedError = Error & {
  statusCode?: number;
  code?: unknown;
  Code?: unknown;
  validation?: { instancePath?: string; message?: string; params?: unknown }[];
  validationContext?: string;
  details?: unknown;
  $metadata?: { httpStatusCode?: number };
};

/**
 * One completion line per request.
 * Health probes stay quiet unless they fail. 4xx on a real route is a warn
 * with the cause; 5xx is an error with a stack. Scanner 404s stay at info.
 */
export class RequestLogController extends LogController {
  #errors = new WeakMap<FastifyRequest, Error>();

  override incomingRequest(request: FastifyRequest): void {
    if (isHealthProbe(request)) return;
    request.log.debug({ req: request }, "incoming request");
  }

  override routeNotFound(): void {
    // The completion line already carries status 404.
  }

  override defaultErrorLog(error: Error, request: FastifyRequest): void {
    this.#errors.set(request, error);
  }

  override requestCompleted(
    socketError: Error | null | undefined,
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    const error = this.#errors.get(request) ?? socketError ?? undefined;
    if (isQuietSuccess(request, reply.statusCode, error)) return;

    const level = levelFor(request, reply.statusCode, error);
    const fields: Record<string, unknown> = {
      req: request,
      res: reply,
      responseTime: Math.round(reply.elapsedTime * 100) / 100,
    };
    if (error) fields.err = error;
    request.log[level](fields, messageFor(request, reply.statusCode, error));
  }
}

export function resolveLogLevel(value: string | undefined): LogLevelName {
  if (value && LOG_LEVELS.includes(value as LogLevelName)) {
    return value as LogLevelName;
  }
  return "info";
}

/** Scalar context for the error log only. Non-enumerable so it stays out of the HTTP body. */
export function withDetails<T extends Error>(error: T, details: LogDetails): T {
  Object.defineProperty(error, "details", {
    value: details,
    enumerable: false,
  });
  return error;
}

export const loggerOptions = {
  level: resolveLogLevel(process.env.LOG_LEVEL),
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
  serializers: {
    req(request: FastifyRequest) {
      const route = request.routeOptions?.url;
      return {
        method: request.method,
        url: request.url,
        ...(route ? { route } : {}),
        ip: request.ip,
      };
    },
    err(error: FastifyError) {
      return serializeError(error);
    },
  },
};

export function serializeError(error: Error): SerializedError {
  const err = error as LoggedError;
  const statusCode =
    typeof err.statusCode === "number" ? err.statusCode : undefined;
  const out: {
    type: string;
    message: string;
    stack?: string;
    [key: string]: unknown;
  } = {
    type: err.name,
    message: err.message,
  };
  if (statusCode !== undefined) out.statusCode = statusCode;

  const code = typeof err.code === "string" ? err.code : undefined;
  const awsCode = typeof err.Code === "string" ? err.Code : undefined;
  if (code) out.code = code;
  else if (awsCode) out.code = awsCode;

  if (err.validationContext) out.validationContext = err.validationContext;
  if (Array.isArray(err.validation)) {
    out.validation = err.validation.slice(0, 8).map((issue) => ({
      path: issue.instancePath || missingProperty(issue.params),
      message: issue.message,
    }));
  }

  const upstreamStatus = err.$metadata?.httpStatusCode;
  if (typeof upstreamStatus === "number") out.upstreamStatus = upstreamStatus;

  if (isLogDetails(err.details)) out.details = err.details;

  if (statusCode === undefined || statusCode >= 500) {
    out.stack = err.stack ?? "";
  }
  return out as SerializedError;
}

type SerializedError = {
  type: string;
  message: string;
  stack: string;
  [key: string]: unknown;
};

function isHealthProbe(request: { url?: string }) {
  const url = request.url ?? "";
  return url === "/health" || url.startsWith("/health?");
}

function isQuietSuccess(
  request: FastifyRequest,
  statusCode: number,
  error: Error | undefined,
) {
  if (error || statusCode >= 400) return false;
  if (isHealthProbe(request)) return true;
  return request.method === "OPTIONS";
}

function levelFor(
  request: FastifyRequest,
  statusCode: number,
  error: Error | undefined,
): "info" | "warn" | "error" {
  if (statusCode >= 500) return "error";
  if (closedEarly(statusCode, error)) return "warn";
  if (statusCode >= 400 && !request.is404) return "warn";
  return "info";
}

function messageFor(
  request: FastifyRequest,
  statusCode: number,
  error: Error | undefined,
) {
  if (statusCode >= 500 || closedEarly(statusCode, error))
    return "request failed";
  if (statusCode >= 400 && !request.is404) return "request rejected";
  return "request completed";
}

function closedEarly(statusCode: number, error: Error | undefined) {
  return error !== undefined && statusCode < 400;
}

function missingProperty(params: unknown) {
  if (!params || typeof params !== "object" || !("missingProperty" in params)) {
    return "";
  }
  const value = params.missingProperty;
  return typeof value === "string" ? value : "";
}

function isLogDetails(value: unknown): value is LogDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (item) =>
      item === null ||
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean",
  );
}
