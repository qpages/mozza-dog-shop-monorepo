import fp from "fastify-plugin";
import type { PublicOwnerEvent } from "./shooting/owner-events.js";

const ERROR_REPEAT_WINDOW_MS = 60_000;

export type Notification =
  | {
      scenario: "owner_event.created";
      type: PublicOwnerEvent["type"];
      email: string;
      shootingName: string | null;
    }
  | {
      scenario: "api.error";
      status: number | null;
      method: string;
      route: string;
      message: string;
      requestId: string;
    };

export type Notifier = (notification: Notification) => Promise<void>;

type NotifyLog = {
  warn: (obj: object, msg: string) => void;
};

export function shouldNotifyHttpError(input: {
  statusCode: number;
  routeNotFound: boolean;
}) {
  if (input.routeNotFound) return false;
  return input.statusCode >= 400;
}

export function formatNotification(notification: Notification) {
  if (notification.scenario === "api.error") {
    const status =
      notification.status === null ? "" : `${notification.status} `;
    return `${status}${notification.method} ${notification.route} : ${notification.message} (${notification.requestId})`;
  }

  const shooting = notification.shootingName
    ? ` « ${notification.shootingName} »`
    : "";

  switch (notification.type) {
    case "shooting_opened":
      return notification.shootingName
        ? `${notification.email} a ouvert la galerie${shooting}.`
        : `${notification.email} a ouvert une galerie.`;
    case "zip_downloaded":
      return notification.shootingName
        ? `${notification.email} a téléchargé l'archive ZIP${shooting}.`
        : `${notification.email} a téléchargé une archive ZIP.`;
    case "photo_downloaded":
      return notification.shootingName
        ? `${notification.email} a téléchargé une photo${shooting}.`
        : `${notification.email} a téléchargé une photo.`;
    case "participation_claimed":
      return `${notification.email} a demandé à être rattaché à un shooting.`;
    case "instagram_message":
      return `${notification.email} a laissé un message Instagram.`;
  }
}

export function createNotifier(options: {
  slackWebhookUrl: string;
  log: NotifyLog;
  fetch?: typeof fetch;
  now?: () => number;
}): Notifier {
  const webhookUrl = options.slackWebhookUrl.trim();
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const sentAt = new Map<string, number>();

  return async (notification) => {
    if (!webhookUrl) return;
    if (
      notification.scenario === "api.error" &&
      repeated(sentAt, notification, now())
    ) {
      return;
    }

    try {
      const response = await fetchImpl(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: formatNotification(notification) }),
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) {
        options.log.warn(
          { status: response.status, scenario: notification.scenario },
          "slack notification failed",
        );
      }
    } catch (error) {
      options.log.warn(
        { err: error, scenario: notification.scenario },
        "slack notification failed",
      );
    }
  };
}

function repeated(
  sentAt: Map<string, number>,
  notification: Extract<Notification, { scenario: "api.error" }>,
  at: number,
) {
  for (const [key, sent] of sentAt) {
    if (at - sent >= ERROR_REPEAT_WINDOW_MS) sentAt.delete(key);
  }
  const key = `${notification.method} ${notification.route}\n${notification.message}`;
  const previous = sentAt.get(key);
  if (previous !== undefined && at - previous < ERROR_REPEAT_WINDOW_MS) {
    return true;
  }
  sentAt.set(key, at);
  return false;
}

function statusCodeOf(error: { statusCode?: number }) {
  return typeof error.statusCode === "number" ? error.statusCode : 500;
}

export default fp(
  async (app) => {
    const notify = createNotifier({
      slackWebhookUrl: app.config.SLACK_WEBHOOK_URL,
      log: app.log,
    });
    app.decorate("notify", notify);

    app.addHook("onError", async (request, _reply, error) => {
      const statusCode = statusCodeOf(error);
      if (
        !shouldNotifyHttpError({
          statusCode,
          routeNotFound: request.is404,
        })
      ) {
        return;
      }
      void notify({
        scenario: "api.error",
        status: statusCode,
        method: request.method,
        route: request.routeOptions.url ?? request.url,
        message: error.message,
        requestId: request.id,
      });
    });
  },
  { name: "notify" },
);
