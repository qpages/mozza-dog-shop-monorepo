type NamingInput = {
  shootingName: string;
  dogNames: string[];
  /** 0-based index in gallery order (matches lightbox « 1 / n »). */
  index: number;
};

export function formatDogNames(names: string[]): string | null {
  const dogs = names.map((name) => name.trim()).filter(Boolean);
  if (dogs.length === 0) return null;
  if (dogs.length === 1) return dogs[0];
  if (dogs.length === 2) return `${dogs[0]} et ${dogs[1]}`;
  return `${dogs.slice(0, -1).join(", ")} et ${dogs[dogs.length - 1]}`;
}

/** Human label for UI (no file extension). */
export function photoTitle(input: NamingInput): string {
  const number = input.index + 1;
  const dogs = formatDogNames(input.dogNames);
  const shooting = input.shootingName.trim();
  if (dogs) return `${dogs} — photo ${number}`;
  if (shooting) return `${shooting} — photo ${number}`;
  return `Photo ${number}`;
}

export function photoDownloadFilename(
  input: NamingInput & { contentType: string },
): string {
  const ext = photoExtension(input.contentType);
  const dogs = formatDogNames(input.dogNames);
  const shooting = input.shootingName.trim();
  const number = input.index + 1;
  let base: string;
  if (dogs && shooting) {
    base = `${dogs} — ${shooting} — photo ${number}`;
  } else if (dogs) {
    base = `${dogs} — photo ${number}`;
  } else if (shooting) {
    base = `${shooting} — photo ${number}`;
  } else {
    base = `Photo ${number}`;
  }
  return `${safeFilename(base)}.${ext}`;
}

export function shootingArchiveFilename(shootingName: string): string {
  const base = shootingName.trim();
  return `${safeFilename(base || "Photos")}.zip`;
}

function photoExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

/** Strip characters unsafe in zip entries and download paths. */
function safeFilename(name: string): string {
  return (
    name
      .replace(/[/\\:*?"<>|\0]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 150) || "Photo"
  );
}
