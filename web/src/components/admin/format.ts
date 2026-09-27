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
