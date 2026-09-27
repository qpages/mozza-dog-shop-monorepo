import { apiUrl } from "@/lib/api";

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
  }[];
};

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export async function getSession(): Promise<string | null> {
  try {
    const response = await fetch(`${apiUrl}/admin/session`, {
      credentials: "include",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { email: string };
    return body.email;
  } catch {
    return null;
  }
}

export async function login(
  email: string,
  password: string,
): Promise<string | null> {
  const response = await fetch(`${apiUrl}/admin/session`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { email: string };
  return body.email;
}

export async function logout(): Promise<boolean> {
  const response = await fetch(`${apiUrl}/admin/session`, {
    method: "DELETE",
    credentials: "include",
  });
  return response.ok;
}

export async function listShootings(): Promise<Shooting[] | null> {
  const response = await fetch(`${apiUrl}/admin/shootings`, {
    credentials: "include",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { shootings: Shooting[] };
  return body.shootings;
}

export async function createShooting(input: {
  shotOn: string;
  name: string;
}): Promise<string | null> {
  const response = await fetch(`${apiUrl}/admin/shootings`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { id: string };
  return body.id;
}

export async function setShootingArchived(
  id: string,
  archived: boolean,
): Promise<boolean> {
  const response = await fetch(
    `${apiUrl}/admin/shootings/${id}/${archived ? "archive" : "restore"}`,
    { method: "POST", credentials: "include" },
  );
  return response.ok;
}

export async function deleteShooting(id: string): Promise<boolean> {
  const response = await fetch(`${apiUrl}/admin/shootings/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return response.ok;
}

export async function addDogs(
  shootingId: string,
  input: { email: string; names: string[] },
): Promise<{ added: string[]; skipped: string[] } | "duplicate" | "error"> {
  const response = await fetch(`${apiUrl}/admin/shootings/${shootingId}/dogs`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status === 409) return "duplicate";
  if (!response.ok) return "error";
  return (await response.json()) as { added: string[]; skipped: string[] };
}

export async function removeDog(
  shootingId: string,
  ownerId: string,
  name: string,
): Promise<"ok" | "error"> {
  const response = await fetch(
    `${apiUrl}/admin/shootings/${shootingId}/owners/${ownerId}/dogs`,
    {
      method: "DELETE",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  if (!response.ok) return "error";
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
        message: `${file.name} dépasse 10 Mo.`,
      });
      continue;
    }

    const presign = await fetch(
      `${apiUrl}/admin/shootings/${shootingId}/owners/${ownerId}/photos/presign`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          byteSize: file.size,
        }),
      },
    );
    if (!presign.ok) {
      failures.push({
        name: file.name,
        message: `Envoi impossible pour ${file.name}.`,
      });
      continue;
    }
    const signed = (await presign.json()) as {
      url: string;
      objectKey: string;
      contentType: string;
      byteSize: number;
    };

    const put = await fetch(signed.url, {
      method: "PUT",
      headers: { "content-type": signed.contentType },
      body: file,
    });
    if (!put.ok) {
      failures.push({
        name: file.name,
        message: `Stockage refusé pour ${file.name}.`,
      });
      continue;
    }

    const confirm = await fetch(
      `${apiUrl}/admin/shootings/${shootingId}/owners/${ownerId}/photos`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objectKey: signed.objectKey,
          contentType: signed.contentType,
          byteSize: signed.byteSize,
        }),
      },
    );
    if (!confirm.ok) {
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
