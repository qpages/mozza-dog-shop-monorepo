import { cn } from "cn";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileType,
  Weight,
  XIcon,
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
  DialogClose,
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
  const showNav = photos.length > 1;
  const canPrev = index !== null && index > 0;
  const canNext = index !== null && index < photos.length - 1;
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
        if (current <= 0) return;
        event.preventDefault();
        onIndexChange(current - 1);
      } else if (event.key === "ArrowRight") {
        if (current >= photos.length - 1) return;
        event.preventDefault();
        onIndexChange(current + 1);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [index, onIndexChange, photos.length]);

  function step(delta: number) {
    if (index === null || !showNav) return;
    const next = index + delta;
    if (next < 0 || next >= photos.length) return;
    onIndexChange(next);
  }

  return (
    <Dialog
      open={viewing !== null}
      onOpenChange={(open) => {
        if (!open) onIndexChange(null);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          // Fixed viewport frame — size never follows the image.
          // Override DialogContent defaults (w-full / sm:max-w-sm) at every breakpoint.
          "bg-paper text-ink ring-ink/10 shadow-paper flex max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none",
          // Mobile: nearly full screen (small inset only).
          "h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] rounded-xl",
          // Desktop: large stable frame with a calm margin.
          "sm:h-[min(100dvh-2rem,52rem)] sm:w-[min(100vw-2rem,56rem)] sm:rounded-2xl",
        )}
        // Pointer dismiss restores focus with :focus-visible on the thumb —
        // skip that restore so no ring sits on the closed grid. Keyboard
        // (Escape) keeps default restore for continued tabbing.
        finalFocus={(closeType) => (closeType === "keyboard" ? true : false)}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Photo</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {viewing && index !== null ? (
          <>
            <div className="bg-ink/5 relative isolate min-h-0 flex-1">
              <img
                src={viewing.url}
                alt=""
                className="absolute inset-0 size-full object-contain"
              />

              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="bg-paper/95 text-ink ring-ink/10 hover:bg-paper absolute right-2.5 top-2.5 z-10 size-11 shadow-sm ring-1 transition-colors duration-150 active:translate-y-0 sm:size-9"
                  />
                }
              >
                <XIcon />
                <span className="sr-only">Fermer</span>
              </DialogClose>

              {showNav ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Photo précédente"
                    disabled={!canPrev}
                    onClick={() => step(-1)}
                    className="bg-paper/95 text-ink ring-ink/10 hover:bg-paper active:not-aria-[haspopup]:translate-y-0 absolute inset-y-0 left-2.5 z-10 my-auto size-11 shadow-sm ring-1 transition-colors duration-150 disabled:opacity-35 sm:left-3 sm:size-10"
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Photo suivante"
                    disabled={!canNext}
                    onClick={() => step(1)}
                    className="bg-paper/95 text-ink ring-ink/10 hover:bg-paper active:not-aria-[haspopup]:translate-y-0 absolute inset-y-0 right-2.5 z-10 my-auto size-11 shadow-sm ring-1 transition-colors duration-150 disabled:opacity-35 sm:right-3 sm:size-10"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </>
              ) : null}
            </div>

            <div className="border-ink/10 flex shrink-0 flex-col gap-2.5 border-t px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
              <div className="min-w-0 flex-1 space-y-1">
                {viewing.title ? (
                  <p
                    className="text-ink truncate text-sm font-medium leading-snug"
                    title={viewing.title}
                  >
                    {viewing.title}
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <dl
                    className={cn(
                      "type-caption flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1",
                      subtleText,
                    )}
                  >
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
                  {showNav ? (
                    <p
                      className={cn(
                        "type-caption shrink-0 tabular-nums sm:hidden",
                        subtleText,
                      )}
                      aria-live="polite"
                    >
                      {index + 1} / {photos.length}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center sm:justify-end">
                {showNav ? (
                  <p
                    className={cn(
                      "type-caption hidden tabular-nums sm:block",
                      subtleText,
                    )}
                    aria-live="polite"
                  >
                    {index + 1} / {photos.length}
                  </p>
                ) : null}
                {actions ? (
                  <div className="**:data-[slot=button]:min-h-11 **:data-[slot=button]:w-full sm:**:data-[slot=button]:min-h-8 sm:**:data-[slot=button]:w-auto grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                    {actions}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
