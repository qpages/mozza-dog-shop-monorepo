import { resolveApiUrl } from "@/lib/api";

export type OwnerPhoto = {
  id: string;
  url: string;
  thumbUrl: string;
  downloadUrl: string;
  title: string;
  byteSize: number;
  contentType: string;
  uploadedAt: string;
};

export type OwnerShooting = {
  id: string;
  shotOn: string;
  name: string;
  dogs: string[];
  photos: OwnerPhoto[];
};

export async function fetchOwnerGallery(
  email: string,
): Promise<OwnerShooting[] | null> {
  try {
    const response = await fetch(
      `${resolveApiUrl()}/photos?email=${encodeURIComponent(email)}`,
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { shootings: OwnerShooting[] };
    return body.shootings;
  } catch {
    return null;
  }
}

export function downloadPhoto(photo: OwnerPhoto) {
  const link = document.createElement("a");
  link.href = photo.downloadUrl || photo.url;
  link.download = "";
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

export function shootingArchiveUrl(email: string, shootingId: string) {
  return `${resolveApiUrl()}/photos/archive?email=${encodeURIComponent(email)}&shooting=${encodeURIComponent(shootingId)}`;
}

/** Fallback zip name when Content-Disposition is not readable (CORS). */
export function archiveFilenameFromShootingName(shootingName: string): string {
  const base =
    shootingName
      .trim()
      .replace(/[/\\:*?"<>|\0]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 150) || "Photos";
  return `${base}.zip`;
}

export function triggerArchiveDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* ignore malformed encoding */
    }
  }
  const quoted = /filename\s*=\s*"((?:\\.|[^"\\])*)"/i.exec(header);
  if (quoted?.[1]) return quoted[1].replace(/\\(.)/g, "$1").trim();
  const plain = /filename\s*=\s*([^;]+)/i.exec(header);
  if (plain?.[1]) return plain[1].trim().replace(/^["']|["']$/g, "");
  return null;
}

/**
 * True when the browser may accept sharing a zip via navigator.share({ files }).
 * Used to skip the busy/fetch path on desktop Chrome (share exists, files rejected).
 */
export function canAttemptArchiveShare(): boolean {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function"
  ) {
    return false;
  }
  try {
    return navigator.canShare({
      files: [new File([], "photos.zip", { type: "application/zip" })],
    });
  } catch {
    return false;
  }
}

/**
 * Try the Web Share API with the zip file (iOS Photos / Files sheet).
 * Returns "shared", "aborted" (user dismissed), or "unsupported" (caller should download).
 */
export async function shareArchiveIfPossible(options: {
  url: string;
  fallbackFilename: string;
  title: string;
}): Promise<"shared" | "aborted" | "unsupported"> {
  if (!canAttemptArchiveShare()) return "unsupported";

  try {
    const response = await fetch(options.url);
    if (!response.ok) return "unsupported";
    const blob = await response.blob();
    const name =
      filenameFromContentDisposition(
        response.headers.get("Content-Disposition"),
      ) ?? options.fallbackFilename;
    const file = new File([blob], name || "photos.zip", {
      type: "application/zip",
    });
    if (!navigator.canShare({ files: [file] })) return "unsupported";
    await navigator.share({ files: [file], title: options.title });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "aborted";
    }
    return "unsupported";
  }
}

export function viewPhoto(photo: OwnerPhoto) {
  window.open(photo.url, "_blank", "noopener,noreferrer");
}
