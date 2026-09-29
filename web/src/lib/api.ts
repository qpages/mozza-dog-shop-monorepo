const configuredApiUrl =
  import.meta.env.PUBLIC_API_URL ?? "http://localhost:8787";

/**
 * When the page is opened via a LAN / Docker IP (e.g. http://192.168.1.63:4321)
 * but PUBLIC_API_URL still points at localhost, rewrite the API host so the
 * browser hits the same machine instead of the client's own loopback.
 */
export function resolveApiUrl(configured = configuredApiUrl): string {
  if (typeof window === "undefined") return configured;
  try {
    const url = new URL(configured);
    const pageHost = window.location.hostname;
    const isLoopback =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (isLoopback && pageHost && pageHost !== url.hostname) {
      url.hostname = pageHost;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return configured;
  }
}
