import { cn } from "cn";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileType,
  Weight,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import {
  formatBytes,
  formatDateTime,
  formatMime,
} from "@/components/admin/format";
import { subtleText } from "@/components/admin/styles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type LightboxPhoto = {
  url: string;
  title?: string;
  byteSize: number;
  contentType: string;
  uploadedAt: string;
};

type Props = {
  photos: LightboxPhoto[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  description: string;
  actions?: ReactNode;
  showUploadedAt?: boolean;
};

export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  description,
  actions,
  showUploadedAt = true,
}: Props) {
  const viewing = index !== null ? (photos[index] ?? null) : null;
  const canNavigate = photos.length > 1;
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (index === null) return;
    if (photos.length === 0) {
      onIndexChange(null);
      return;
    }
    if (index >= photos.length) onIndexChange(photos.length - 1);
  }, [index, onIndexChange, photos.length]);

  useEffect(() => {
    if (index === null || photos.length <= 1) return;

    function onKeyDown(event: KeyboardEvent) {
      const current = indexRef.current;
      if (current === null) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onIndexChange((current - 1 + photos.length) % photos.length);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndexChange((current + 1) % photos.length);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [index, onIndexChange, photos.length]);

  function step(delta: number) {
    if (index === null || !canNavigate) return;
    onIndexChange((index + delta + photos.length) % photos.length);
  }

  return (
    <Dialog
      open={viewing !== null}
      onOpenChange={(open) => {
        if (!open) onIndexChange(null);
      }}
    >
      <DialogContent showCloseButton className="gap-3 p-3 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Photo</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {viewing && index !== null ? (
          <>
            <div className="relative">
              <img
                src={viewing.url}
                alt=""
                className="bg-muted max-h-[70vh] w-full rounded-lg object-contain"
              />
              {canNavigate ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Photo précédente"
                    onClick={() => step(-1)}
                    className="bg-paper/90 hover:bg-paper absolute left-2 top-1/2 -translate-y-1/2 shadow-sm"
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Photo suivante"
                    onClick={() => step(1)}
                    className="bg-paper/90 hover:bg-paper absolute right-2 top-1/2 -translate-y-1/2 shadow-sm"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5 px-0.5">
              {viewing.title ? (
                <p
                  className="text-foreground truncate text-sm font-medium leading-snug"
                  title={viewing.title}
                >
                  {viewing.title}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <dl className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                  <div className="inline-flex items-center gap-1.5">
                    <Weight className="size-3.5 shrink-0" aria-hidden />
                    <dt className="sr-only">Taille</dt>
                    <dd>{formatBytes(viewing.byteSize)}</dd>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <FileType className="size-3.5 shrink-0" aria-hidden />
                    <dt className="sr-only">Format</dt>
                    <dd>{formatMime(viewing.contentType)}</dd>
                  </div>
                  {showUploadedAt ? (
                    <div className="inline-flex items-center gap-1.5">
                      <Calendar className="size-3.5 shrink-0" aria-hidden />
                      <dt className="sr-only">Uploadé le</dt>
                      <dd>{formatDateTime(viewing.uploadedAt)}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="flex items-center gap-3">
                  {canNavigate ? (
                    <p
                      className={cn("text-sm tabular-nums", subtleText)}
                      aria-live="polite"
                    >
                      {index + 1} / {photos.length}
                    </p>
                  ) : null}
                  {actions}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
