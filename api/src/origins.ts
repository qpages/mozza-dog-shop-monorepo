/** Comma-separated WEB_ORIGIN values, trimmed. */
export function parseWebOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** True for localhost / RFC1918 / 127.0.0.0/8 http(s) origins (LAN / Docker / OrbStack). */
export function isDevLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname;
    if (host === "localhost") return true;
    if (/^127(?:\.\d{1,3}){3}$/.test(host)) return true;
    if (/^10(?:\.\d{1,3}){3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(host)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

export function createCorsOriginChecker(
  configured: string,
  nodeEnv: string,
): (
  origin: string | undefined,
  cb: (err: Error | null, allow: boolean | string) => void,
) => void {
  const allowed = new Set(parseWebOrigins(configured));
  const relaxLocal = nodeEnv !== "production";

  return (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    if (allowed.has(origin) || (relaxLocal && isDevLocalOrigin(origin))) {
      cb(null, origin);
      return;
    }
    cb(null, false);
  };
}
