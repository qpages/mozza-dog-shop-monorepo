import { Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { Button } from "@/components/ui/button";
import {
  downloadPhoto,
  viewPhoto,
  type OwnerShooting,
} from "@/lib/photos-client";

type Props = {
  shooting: OwnerShooting;
};

export function OwnerGallery({ shooting }: Props) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const viewing =
    viewingIndex !== null ? (shooting.photos[viewingIndex] ?? null) : null;

  return (
    <>
      {shooting.photos.length === 0 ? (
        <p className="type-caption text-ink/60 py-8 text-center">
          Les photos de ce shooting n’ont pas encore été mises en ligne.
        </p>
      ) : (
        <ul
          className="flex flex-wrap gap-2"
          aria-label={`Photos de ${shooting.name}`}
        >
          {shooting.photos.map((photo, index) => (
            <li
              key={photo.id}
              className="w-[calc(50%-0.25rem)] sm:w-40 md:w-44"
            >
              <button
                type="button"
                aria-label="Agrandir la photo"
                onClick={() => setViewingIndex(index)}
                className="bg-ink/5 ring-ink/5 focus-visible:ring-canvas/50 relative block aspect-square w-full overflow-hidden rounded-lg outline-none ring-1 transition-shadow duration-200 focus-visible:ring-2"
              >
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <PhotoLightbox
        photos={shooting.photos}
        index={viewingIndex}
        onIndexChange={setViewingIndex}
        description="Aperçu de votre photo."
        showUploadedAt={false}
        actions={
          viewing ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => viewPhoto(viewing)}
              >
                <ExternalLink />
                Voir
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => downloadPhoto(viewing)}
              >
                <Download />
                Télécharger
              </Button>
            </>
          ) : null
        }
      />
    </>
  );
}
