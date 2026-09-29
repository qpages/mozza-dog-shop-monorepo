import { resolveApiUrl } from "@/lib/api";

export type OwnerPhoto = {
  id: string;
  url: string;
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

export function viewPhoto(photo: OwnerPhoto) {
  window.open(photo.url, "_blank", "noopener,noreferrer");
}
