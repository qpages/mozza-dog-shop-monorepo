import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";

type Gallery = {
  shootings: {
    id: string;
    shotOn: string;
    dogs: {
      id: string;
      name: string;
      photos: { id: string; url: string; byteSize: number }[];
    }[];
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
        <label htmlFor="email" className="text-sm font-medium">
          E-mail du shooting
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@email.com"
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-3 h-9 rounded-lg border px-3 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus-visible:border-[#46704C] focus-visible:ring-[#46704C]/15"
        />
        <Button type="submit" size="lg" className="w-full">
          Récupérer mes photos
        </Button>
      </form>
    );
  }

  const photoCount = gallery?.shootings.reduce(
    (total, shooting) =>
      total + shooting.dogs.reduce((sum, dog) => sum + dog.photos.length, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      {status === "loading" ? (
        <p className="text-muted-foreground animate-pulse text-sm motion-reduce:animate-none">
          Chargement…
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-destructive text-sm">
          Le service photo est indisponible.
        </p>
      ) : null}
      {gallery && photoCount === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune photo pour{" "}
          <span className="text-foreground font-medium">{email}</span>.
        </p>
      ) : null}
      {gallery?.shootings.map((shooting) => (
        <section key={shooting.id} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">{formatDate(shooting.shotOn)}</h2>
          {shooting.dogs.map((dog) => (
            <div key={dog.id} className="flex flex-col gap-2">
              <p className="text-muted-foreground text-sm">{dog.name}</p>
              <div className="grid grid-cols-2 gap-2">
                {dog.photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg"
                  >
                    <img
                      src={photo.url}
                      alt={`Photo de ${dog.name}`}
                      className="aspect-square w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      <Button variant="outline" nativeButton={false} render={<a href="/" />}>
        Autre e-mail
      </Button>
    </div>
  );
}
