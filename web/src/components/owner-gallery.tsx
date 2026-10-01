import { Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { quietCta } from "@/components/admin/styles";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { Button } from "@/components/ui/button";
import {
  downloadPhoto,
  viewPhoto,
  type OwnerShooting,
} from "@/lib/photos-client";

type Props = {
  email: string;
  shooting: OwnerShooting;
};

export function OwnerGallery({ email, shooting }: Props) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const viewing =
    viewingIndex !== null ? (shooting.photos[viewingIndex] ?? null) : null;

  return (
    <>
      {shooting.photos.length === 0 ? (
        <p className="type-body text-ink/60 py-8 text-center">
          Les photos de ce shooting n’ont pas encore été mises en ligne.
        </p>
      ) : (
        <ul
          className="photo-tiles flex flex-wrap gap-2"
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
                className="photo-tile bg-ink/5 ring-ink/5 focus-visible:ring-canvas/50 relative block aspect-square w-full overflow-hidden rounded-lg outline-none ring-1 focus-visible:ring-2"
              >
                <img
                  src={photo.thumbUrl || photo.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
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
        mobileHint="Maintiens la photo pour l'enregistrer."
        actions={
          viewing ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  quietCta,
                  "min-h-11 touch-manipulation text-base sm:min-h-8 sm:text-sm",
                )}
                onClick={() => viewPhoto(viewing)}
              >
                <ExternalLink />
                Voir
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-11 touch-manipulation text-base sm:min-h-8 sm:text-sm"
                onClick={() => downloadPhoto(email, viewing)}
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
