import type { Shooting } from "@/lib/admin-client";

export function formatDate(shotOn: string) {
  return new Date(`${shotOn}T00:00:00`).toLocaleDateString("fr-FR", {
    dateStyle: "long",
  });
}

export function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function photoLabel(count: number) {
  if (count === 0) return "aucune photo";
  return count === 1 ? "1 photo" : `${count} photos`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("fr-FR")} ${units[unit]}`;
}

export function formatMime(contentType: string) {
  const subtype = contentType.split("/")[1] ?? contentType;
  return subtype.toUpperCase();
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function participantLabel(count: number) {
  if (count === 0) return "aucun participant";
  return count === 1 ? "1 participant" : `${count} participants`;
}

export function photoTotal(shooting: Shooting) {
  return shooting.owners.reduce((sum, owner) => sum + owner.photoCount, 0);
}

export type ShootingFactId = "date" | "participants" | "photos";

export function shootingFacts(shooting: Shooting) {
  const participants = shooting.owners.length;
  const facts: { id: ShootingFactId; label: string }[] = [
    { id: "date", label: formatDate(shooting.shotOn) },
    { id: "participants", label: participantLabel(participants) },
  ];
  if (participants > 0) {
    facts.push({ id: "photos", label: photoLabel(photoTotal(shooting)) });
  }
  return facts;
}

export type ClaimFactId = "date" | "received" | "dog" | "email";

export function claimDisplayName(claim: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  return `${claim.firstName} ${claim.lastName}`.trim() || claim.email;
}

export function claimFacts(claim: {
  firstName: string;
  lastName: string;
  email: string;
  dogName: string;
  shootingDate: string;
  createdAt: string;
}) {
  const facts: { id: ClaimFactId; label: string }[] = [
    { id: "date", label: formatDate(claim.shootingDate) },
    {
      id: "received",
      label: new Date(claim.createdAt).toLocaleDateString("fr-FR", {
        dateStyle: "long",
      }),
    },
  ];
  if (claim.dogName.trim()) {
    facts.push({ id: "dog", label: claim.dogName.trim() });
  }
  facts.push({ id: "email", label: claim.email });
  return facts;
}

export function activeClaimLabel(count: number) {
  if (count === 0) return "aucun signalement actif";
  return count === 1 ? "1 signalement actif" : `${count} signalements actifs`;
}
