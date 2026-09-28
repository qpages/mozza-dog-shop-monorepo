import { cn } from "cn";
import { Check } from "lucide-react";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { quietCta, subtleText } from "@/components/admin/styles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Photo } from "@/lib/admin-client";

export type PhotoStripHandle = {
  confirmSelected: () => void;
};

type Props = {
  photos: Photo[];
  archived: boolean;
  deleting: boolean;
  selectMode: boolean;
  idleFocusRef: RefObject<HTMLButtonElement | null>;
  onSelectModeChange: (value: boolean) => void;
  onSelectedCountChange: (count: number) => void;
  onDelete: (photoIds: string[]) => void;
  ref?: Ref<PhotoStripHandle>;
};

export function PhotoStrip({
  photos,
  archived,
  deleting,
  selectMode,
  idleFocusRef,
  onSelectModeChange,
  onSelectedCountChange,
  onDelete,
  ref,
}: Props) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Frozen at open time so the title/description stay stable while the dialog
  // animates closed (clearing the selection would otherwise flash "0 photos").
  const [confirmCount, setConfirmCount] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const wasSelecting = useRef(false);
  const skipFocus = useRef(false);

  const count = selected.size;
  const allSelected = count > 0 && count === photos.length;

  // Leaving selection via Annuler should return to the header delete control.
  // Confirming a deletion is skipped: the dialog restores focus on its own.
  useEffect(() => {
    if (!skipFocus.current && !selectMode && wasSelecting.current) {
      idleFocusRef.current?.focus();
    }
    skipFocus.current = false;
    wasSelecting.current = selectMode;
  }, [idleFocusRef, selectMode]);

  useEffect(() => {
    if (!selectMode) setSelected(new Set());
  }, [selectMode]);

  useEffect(() => {
    onSelectedCountChange(count);
  }, [count, onSelectedCountChange]);

  function openConfirm() {
    if (count === 0 || deleting) return;
    setConfirmCount(count);
    setConfirmOpen(true);
  }

  useImperativeHandle(ref, () => ({ confirmSelected: openConfirm }), [
    count,
    deleting,
  ]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    onSelectModeChange(false);
  }

  function confirmDelete() {
    const ids = [...selected];
    setConfirmOpen(false);
    skipFocus.current = true;
    exitSelect();
    onDelete(ids);
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      {archived || !selectMode ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            role="status"
            aria-live="polite"
            className={cn("text-sm tabular-nums", subtleText)}
          >
            {count === 0
              ? "Sélectionnez des photos"
              : `${count} sélectionnée${count > 1 ? "s" : ""}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-ink/70 hover:bg-canvas/10 hover:text-ink"
              onClick={() =>
                setSelected(
                  allSelected
                    ? new Set()
                    : new Set(photos.map((photo) => photo.id)),
                )
              }
            >
              {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-select-cancel
              className="text-ink/70 hover:bg-canvas/10 hover:text-ink"
              onClick={exitSelect}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      <ul className="flex flex-wrap gap-2" aria-label="Photos importées">
        {photos.map((photo, index) => {
          const isSelected = selected.has(photo.id);
          return (
            <li key={photo.id}>
              <button
                type="button"
                aria-pressed={selectMode ? isSelected : undefined}
                aria-label={
                  selectMode
                    ? isSelected
                      ? "Désélectionner la photo"
                      : "Sélectionner la photo"
                    : "Agrandir la photo"
                }
                onClick={() =>
                  selectMode ? toggle(photo.id) : setViewingIndex(index)
                }
                className={cn(
                  "bg-ink/5 relative block size-20 overflow-hidden rounded-lg outline-none transition-[box-shadow,opacity] duration-200 focus-visible:ring-2 sm:size-24",
                  selectMode && isSelected
                    ? "ring-canvas ring-2"
                    : "ring-ink/5 focus-visible:ring-canvas/50 ring-1",
                  selectMode && !isSelected && "opacity-70 hover:opacity-100",
                )}
              >
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  className={cn(
                    "size-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    !selectMode && "hover:scale-105",
                  )}
                />
                {selectMode ? (
                  <span
                    className={cn(
                      "absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full border transition-colors duration-150",
                      isSelected
                        ? "bg-canvas border-canvas text-white"
                        : "bg-paper/85 border-ink/20 text-transparent",
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <PhotoLightbox
        photos={photos}
        index={viewingIndex}
        onIndexChange={setViewingIndex}
        description="Aperçu de la photo importée."
      />

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmCount === 1
                ? "Supprimer cette photo ?"
                : `Supprimer ces ${confirmCount} photos ?`}
            </DialogTitle>
            <DialogDescription>
              {confirmCount === 1
                ? "Cette photo sera supprimée définitivement. Le maître ne pourra plus la récupérer."
                : "Ces photos seront supprimées définitivement. Le maître ne pourra plus les récupérer."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={quietCta}
              onClick={() => setConfirmOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
