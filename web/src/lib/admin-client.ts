import { resolveApiUrl } from "@/lib/api";

export type Photo = {
  id: string;
  url: string;
  thumbUrl: string;
  title: string;
  byteSize: number;
  contentType: string;
  uploadedAt: string;
};

export type Shooting = {
  id: string;
  shotOn: string;
  name: string;
  archived: boolean;
  owners: {
    id: string;
    email: string;
    photoCount: number;
    dogs: string[];
    photos: Photo[];
  }[];
};

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export const PHOTO_UPLOAD_REQUIRES_DOG_MESSAGE =
  "Ajoute au moins un chien à ce participant avant d'importer des photos.";

export const API_UNREACHABLE_MESSAGE =
  "Une erreur est survenue. Réessaie dans un instant.";

async function request(
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  try {
    return await fetch(`${resolveApiUrl()}${path}`, {
      ...init,
      credentials: init.credentials ?? "include",
    });
  } catch {
    return null;
  }
}

async function apiErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: string };
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function getSession(): Promise<string | null> {
  const response = await request("/admin/session");
  if (!response?.ok) return null;
  const body = (await response.json()) as { email: string };
  return body.email;
}

export type LoginResult =
  { ok: true; email: string } | { ok: false; message: string };

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const response = await request("/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response) {
    return { ok: false, message: API_UNREACHABLE_MESSAGE };
  }
  if (response.ok) {
    const body = (await response.json()) as { email: string };
    return { ok: true, email: body.email };
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, message: "E-mail ou mot de passe incorrect." };
  }
  const fromApi = await apiErrorMessage(response);
  return {
    ok: false,
    message: fromApi ?? "Connexion impossible. Réessaie dans un instant.",
  };
}

export async function logout(): Promise<boolean> {
  const response = await request("/admin/session", { method: "DELETE" });
  return response?.ok === true;
}

export type OwnerEventType =
  | "shooting_opened"
  | "zip_downloaded"
  | "photo_downloaded"
  | "participation_claimed"
  | "instagram_message";

export type OwnerEvent = {
  id: string;
  email: string;
  type: OwnerEventType;
  shootingId: string | null;
  shootingName: string | null;
  photoId: string | null;
  createdAt: string;
};

export async function listOwnerEvents(): Promise<OwnerEvent[] | null> {
  const response = await request("/admin/owner-events");
  if (!response?.ok) return null;
  const body = (await response.json()) as { events: OwnerEvent[] };
  return body.events;
}

export async function listShootings(): Promise<Shooting[] | null> {
  const response = await request("/admin/shootings");
  if (!response?.ok) return null;
  const body = (await response.json()) as { shootings: Shooting[] };
  return body.shootings;
}

export async function createShooting(input: {
  shotOn: string;
  name: string;
}): Promise<string | null> {
  const response = await request("/admin/shootings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response?.ok) return null;
  const body = (await response.json()) as { id: string };
  return body.id;
}

export async function updateShooting(
  id: string,
  input: { shotOn: string; name: string },
): Promise<boolean> {
  const response = await request(`/admin/shootings/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return response?.ok === true;
}

export async function setShootingArchived(
  id: string,
  archived: boolean,
): Promise<boolean> {
  const response = await request(
    `/admin/shootings/${id}/${archived ? "archive" : "restore"}`,
    { method: "POST" },
  );
  return response?.ok === true;
}

export async function deleteShooting(id: string): Promise<boolean> {
  const response = await request(`/admin/shootings/${id}`, {
    method: "DELETE",
  });
  return response?.ok === true;
}

export type OwnerSuggestion = {
  id: string;
  email: string;
  dogs: string[];
};

export async function searchOwners(
  query: string,
  signal?: AbortSignal,
): Promise<OwnerSuggestion[] | null> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const response = await request(`/admin/owners?${params}`, { signal });
  if (!response?.ok) return null;
  const body = (await response.json()) as { owners: OwnerSuggestion[] };
  return body.owners;
}

export async function changeOwnerEmail(
  shootingId: string,
  ownerId: string,
  email: string,
): Promise<"ok" | "taken" | "error"> {
  const response = await request(
    `/admin/shootings/${shootingId}/owners/${ownerId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );
  if (!response) return "error";
  if (response.ok) return "ok";
  if (response.status === 409) {
    const message = await apiErrorMessage(response);
    return message === "email already used" ? "taken" : "error";
  }
  return "error";
}

export async function removeShootingOwner(
  shootingId: string,
  ownerId: string,
): Promise<"ok" | "error"> {
  const response = await request(
    `/admin/shootings/${shootingId}/owners/${ownerId}`,
    { method: "DELETE" },
  );
  if (!response?.ok) return "error";
  return "ok";
}

export async function addShootingOwner(
  shootingId: string,
  input: { email: string; names?: string[] },
): Promise<{ added: string[]; skipped: string[] } | "duplicate" | "error"> {
  const response = await request(`/admin/shootings/${shootingId}/owners`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: input.email, names: input.names ?? [] }),
  });
  if (!response) return "error";
  if (response.status === 409) return "duplicate";
  if (!response.ok) return "error";
  return (await response.json()) as { added: string[]; skipped: string[] };
}

export async function addDogs(
  ownerId: string,
  names: string[],
): Promise<{ added: string[]; skipped: string[] } | "duplicate" | "error"> {
  const response = await request(`/admin/owners/${ownerId}/dogs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ names }),
  });
  if (!response) return "error";
  if (response.status === 409) return "duplicate";
  if (!response.ok) return "error";
  return (await response.json()) as { added: string[]; skipped: string[] };
}

export async function removeDog(
  ownerId: string,
  name: string,
): Promise<"ok" | "error"> {
  const response = await request(`/admin/owners/${ownerId}/dogs`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response?.ok) return "error";
  return "ok";
}

export async function deletePhotos(
  shootingId: string,
  ownerId: string,
  photoIds: string[],
): Promise<"ok" | "error"> {
  const response = await request(
    `/admin/shootings/${shootingId}/owners/${ownerId}/photos`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: photoIds }),
    },
  );
  if (!response?.ok) return "error";
  return "ok";
}

export async function uploadPhotos(
  shootingId: string,
  ownerId: string,
  files: File[],
): Promise<{ added: number; failures: { name: string; message: string }[] }> {
  const failures: { name: string; message: string }[] = [];
  let added = 0;

  for (const file of files) {
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
      failures.push({
        name: file.name,
        message: `${file.name} : JPEG, PNG ou WebP uniquement.`,
      });
      continue;
    }
    if (file.size < 1 || file.size > MAX_PHOTO_BYTES) {
      failures.push({
        name: file.name,
        message: `${file.name} dépasse 15 Mo.`,
      });
      continue;
    }

    const presign = await request(
      `/admin/shootings/${shootingId}/owners/${ownerId}/photos/presign`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          byteSize: file.size,
        }),
      },
    );
    if (!presign) {
      failures.push({ name: file.name, message: API_UNREACHABLE_MESSAGE });
      break;
    }
    if (!presign.ok) {
      const message =
        (await apiErrorMessage(presign)) ??
        `Envoi impossible pour ${file.name}.`;
      failures.push({ name: file.name, message });
      if (presign.status === 400) break;
      continue;
    }
    const signed = (await presign.json()) as {
      url: string;
      objectKey: string;
      contentType: string;
      byteSize: number;
    };

    let put: Response;
    try {
      put = await fetch(signed.url, {
        method: "PUT",
        headers: { "content-type": signed.contentType },
        body: file,
      });
    } catch {
      failures.push({
        name: file.name,
        message: `Envoi impossible pour ${file.name}.`,
      });
      continue;
    }
    if (!put.ok) {
      failures.push({
        name: file.name,
        message: `Stockage refusé pour ${file.name}.`,
      });
      continue;
    }

    const confirm = await request(
      `/admin/shootings/${shootingId}/owners/${ownerId}/photos`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objectKey: signed.objectKey,
          contentType: signed.contentType,
          byteSize: signed.byteSize,
        }),
      },
    );
    if (!confirm?.ok) {
      failures.push({
        name: file.name,
        message: `Enregistrement impossible pour ${file.name}.`,
      });
      continue;
    }
    added += 1;
  }

  return { added, failures };
}
