import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";

type Gallery = {
  shootings: {
    id: string;
    shotOn: string;
    name: string;
    dogs: string[];
    photos: { id: string; url: string; byteSize: number }[];
  }[];
};

function readEmail() {
  return new URLSearchParams(window.location.search).get("email")?.trim() ?? "";
}

function showEmail(value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("email", value);
  window.history.pushState({}, "", url);
}

function formatDate(shotOn: string) {
  return new Date(`${shotOn}T00:00:00`).toLocaleDateString("fr-FR", {
    dateStyle: "long",
  });
}

export function OwnerPhotos() {
  const [email, setEmail] = useState("");
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const value = readEmail();
    if (!value) return;
    setEmail(value);
    void load(value);
  }, []);

  async function load(value: string) {
    setStatus("loading");
    setGallery(null);
    try {
      const response = await fetch(
        `${apiUrl}/photos?email=${encodeURIComponent(value)}`,
      );
      if (!response.ok) throw new Error("request failed");
      setGallery((await response.json()) as Gallery);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  if (!email) {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const value = String(data.get("email") ?? "").trim();
          if (!value) return;
          showEmail(value);
          setEmail(value);
          void load(value);
        }}
      >
        <label htmlFor="email" className="type-caption font-medium">
          E-mail du shooting
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@email.com"
          className="type-caption border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 h-9 rounded-lg border px-3 outline-none transition-[border-color,box-shadow] duration-200"
        />
        <Button type="submit" size="lg" className="w-full">
          Récupérer mes photos
        </Button>
      </form>
    );
  }

  const photoCount = gallery?.shootings.reduce(
    (total, shooting) => total + shooting.photos.length,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      {status === "loading" ? (
        <p className="type-caption text-muted-foreground animate-pulse motion-reduce:animate-none">
          Chargement…
        </p>
      ) : null}
      {status === "error" ? (
        <p className="type-caption text-destructive">
          Le service photo est indisponible.
        </p>
      ) : null}
      {gallery && photoCount === 0 ? (
        <p className="type-caption text-muted-foreground">
          Aucune photo pour{" "}
          <span className="text-foreground font-medium">{email}</span>.
        </p>
      ) : null}
      {gallery?.shootings.map((shooting) => (
        <section key={shooting.id} className="flex flex-col gap-3">
          <h2 className="type-section">
            {shooting.name}
            <span className="type-caption text-muted-foreground">
              {`, le ${formatDate(shooting.shotOn)}`}
            </span>
          </h2>
          {shooting.dogs.length > 0 ? (
            <p className="type-caption text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              {shooting.dogs.map((dog) => (
                <span key={dog}>{dog}</span>
              ))}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {shooting.photos.map((photo) => (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg"
              >
                <img
                  src={photo.url}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              </a>
            ))}
          </div>
        </section>
      ))}
      <Button variant="outline" nativeButton={false} render={<a href="/" />}>
        Autre e-mail
      </Button>
    </div>
  );
}
