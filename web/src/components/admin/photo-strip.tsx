import { cn } from "cn";
import { Check, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { quietCta, subtleText, touchControl } from "@/components/admin/styles";
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

type Props = {
  photos: Photo[];
  archived: boolean;
  deleting: boolean;
  selectMode: boolean;
  reorderMode: boolean;
  idleFocusRef: RefObject<HTMLButtonElement | null>;
  onSelectModeChange: (value: boolean) => void;
  onReorderModeChange: (value: boolean) => void;
  onDelete: (photoIds: string[]) => void;
  onReorder: (photoIds: string[]) => Promise<boolean>;
};

export function PhotoStrip({
  photos,
  archived,
  deleting,
  selectMode,
  reorderMode,
  idleFocusRef,
  onSelectModeChange,
  onReorderModeChange,
  onDelete,
  onReorder,
}: Props) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCount, setConfirmCount] = useState(0);
  const [draft, setDraft] = useState(photos);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const wasSelecting = useRef(false);
  const skipFocus = useRef(false);
  const saveLock = useRef(false);
  const queuedIds = useRef<string[] | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const reorderModeRef = useRef(reorderMode);
  reorderModeRef.current = reorderMode;

  const count = selected.size;
  const allSelected = count > 0 && count === photos.length;
  const shown =
    reorderMode || photoIdsKey(draft) !== photoIdsKey(photos) ? draft : photos;

  useEffect(() => {
    if (
      !skipFocus.current &&
      !selectMode &&
      !reorderMode &&
      wasSelecting.current
    ) {
      idleFocusRef.current?.focus();
    }
    skipFocus.current = false;
    wasSelecting.current = selectMode || reorderMode;
  }, [idleFocusRef, reorderMode, selectMode]);

  useEffect(() => {
    if (!selectMode) setSelected(new Set());
  }, [selectMode]);

  useEffect(() => {
    if (reorderModeRef.current) return;
    setDraft(photos);
  }, [photos]);

  useEffect(() => {
    if (reorderMode) return;
    setDraggingId(null);
    setOverId(null);
  }, [reorderMode]);

  function openConfirm() {
    if (count === 0 || deleting) return;
    setConfirmCount(count);
    setConfirmOpen(true);
  }

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

  function applyOrder(next: Photo[]) {
    setDraft(next);
    void persist(next.map((photo) => photo.id));
  }

  async function persist(ids: string[]) {
    if (saveLock.current) {
      queuedIds.current = ids;
      return;
    }
    saveLock.current = true;
    let pending: string[] | null = ids;
    try {
      while (pending) {
        const ok = await onReorder(pending);
        pending = queuedIds.current;
        queuedIds.current = null;
        if (!ok) {
          setDraft(photosRef.current);
          queuedIds.current = null;
          break;
        }
      }
    } finally {
      saveLock.current = false;
    }
  }

  async function finishReorder() {
    while (saveLock.current) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    onReorderModeChange(false);
  }

  function moveAt(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= shown.length) return;
    applyOrder(movePhoto(shown, from, to));
  }

  function onDragStart(event: DragEvent<HTMLLIElement>, id: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDraggingId(id);
  }

  function onDragOver(event: DragEvent<HTMLLIElement>, id: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  }

  function onDrop(event: DragEvent<HTMLLIElement>, targetId: string) {
    event.preventDefault();
    const sourceId = draggingId ?? event.dataTransfer.getData("text/plain");
    setDraggingId(null);
    setOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const from = shown.findIndex((photo) => photo.id === sourceId);
    const to = shown.findIndex((photo) => photo.id === targetId);
    moveAt(from, to);
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      {archived || !selectMode ? null : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
          <span
            role="status"
            aria-live="polite"
            className={cn("grid text-sm tabular-nums", subtleText)}
          >
            <span className="invisible col-start-1 row-start-1" aria-hidden>
              Sélectionnez des photos
            </span>
            <span className="col-start-1 row-start-1">
              {count === 0
                ? "Sélectionnez des photos"
                : `${count} sélectionnée${count > 1 ? "s" : ""}`}
            </span>
          </span>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`text-ink/70 hover:bg-canvas/10 hover:text-ink w-full justify-center sm:w-auto ${touchControl}`}
              onClick={() =>
                setSelected(
                  allSelected
                    ? new Set()
                    : new Set(photos.map((photo) => photo.id)),
                )
              }
            >
              <span className="inline-grid">
                <span className="invisible col-start-1 row-start-1" aria-hidden>
                  Tout désélectionner
                </span>
                <span className="col-start-1 row-start-1">
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-select-cancel
              className={`text-ink/70 hover:bg-canvas/10 hover:text-ink w-full justify-center sm:w-auto ${touchControl}`}
              onClick={exitSelect}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={count === 0 || deleting}
              className={`w-full justify-center sm:w-auto ${touchControl}`}
              onClick={openConfirm}
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </Button>
          </div>
        </div>
      )}

      {archived || !reorderMode ? null : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
          <p className={cn("text-sm", subtleText)}>
            Glisse une photo ou utilise les flèches pour changer l'ordre.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-select-cancel
            className={`text-ink/70 hover:bg-canvas/10 hover:text-ink w-full justify-center sm:w-auto ${touchControl}`}
            onClick={() => void finishReorder()}
          >
            Terminé
          </Button>
        </div>
      )}

      <ul className="flex flex-wrap gap-2" aria-label="Photos importées">
        {shown.map((photo, index) => {
          const isSelected = selected.has(photo.id);
          const isDragging = draggingId === photo.id;
          const isOver = overId === photo.id && draggingId !== photo.id;
          return (
            <li
              key={photo.id}
              draggable={reorderMode}
              onDragStart={
                reorderMode
                  ? (event) => onDragStart(event, photo.id)
                  : undefined
              }
              onDragOver={
                reorderMode ? (event) => onDragOver(event, photo.id) : undefined
              }
              onDragLeave={() => {
                if (overId === photo.id) setOverId(null);
              }}
              onDrop={
                reorderMode ? (event) => onDrop(event, photo.id) : undefined
              }
              onDragEnd={() => {
                setDraggingId(null);
                setOverId(null);
              }}
              className={cn(
                reorderMode && "cursor-grab active:cursor-grabbing",
              )}
            >
              <div className="relative">
                <button
                  type="button"
                  aria-pressed={selectMode ? isSelected : undefined}
                  aria-label={
                    selectMode
                      ? isSelected
                        ? "Désélectionner la photo"
                        : "Sélectionner la photo"
                      : reorderMode
                        ? `Photo ${index + 1} sur ${shown.length}`
                        : "Agrandir la photo"
                  }
                  onClick={() => {
                    if (selectMode) toggle(photo.id);
                    else if (!reorderMode) setViewingIndex(index);
                  }}
                  onKeyDown={(event) => {
                    if (!reorderMode) return;
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      moveAt(index, index - 1);
                    }
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      moveAt(index, index + 1);
                    }
                  }}
                  className={cn(
                    "bg-ink/5 relative block size-20 overflow-hidden rounded-lg outline-none transition-[box-shadow,opacity] duration-150 focus-visible:ring-2 sm:size-24",
                    selectMode && isSelected
                      ? "ring-canvas ring-2"
                      : "ring-ink/5 focus-visible:ring-primary/55 ring-1",
                    !selectMode &&
                      !reorderMode &&
                      "hover:ring-primary/60 active:opacity-85",
                    selectMode && !isSelected && "opacity-70 hover:opacity-100",
                    reorderMode && isDragging && "opacity-40",
                    reorderMode && isOver && "ring-canvas ring-2",
                  )}
                >
                  <img
                    src={photo.thumbUrl || photo.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="pointer-events-none size-full object-cover"
                  />
                  {selectMode ? (
                    <span
                      className={cn(
                        "absolute right-1.5 top-1.5 z-10 grid size-5 place-items-center rounded-full border transition-colors duration-150",
                        isSelected
                          ? "bg-canvas border-canvas text-white"
                          : "bg-paper/85 border-ink/20 text-transparent",
                      )}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : null}
                  {reorderMode ? (
                    <span className="bg-paper/80 text-ink/70 pointer-events-none absolute left-1 top-1 z-10 grid size-5 place-items-center rounded-md">
                      <GripVertical className="size-3.5" />
                    </span>
                  ) : null}
                </button>
                {reorderMode ? (
                  <div className="absolute inset-x-0 bottom-1 z-10 flex justify-center gap-0.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-xs"
                      disabled={index === 0}
                      aria-label="Reculer la photo"
                      className="bg-paper/90 text-ink hover:bg-paper size-7 touch-manipulation shadow-sm"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => moveAt(index, index - 1)}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-xs"
                      disabled={index === shown.length - 1}
                      aria-label="Avancer la photo"
                      className="bg-paper/90 text-ink hover:bg-paper size-7 touch-manipulation shadow-sm"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => moveAt(index, index + 1)}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <PhotoLightbox
        photos={shown}
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
                ? "Cette photo sera supprimée définitivement. Le participant ne pourra plus la récupérer."
                : "Ces photos seront supprimées définitivement. Le participant ne pourra plus les récupérer."}
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

function photoIdsKey(photos: Photo[]) {
  return photos.map((photo) => photo.id).join(",");
}

function movePhoto(photos: Photo[], from: number, to: number) {
  const next = [...photos];
  const [photo] = next.splice(from, 1);
  if (!photo) return photos;
  next.splice(to, 0, photo);
  return next;
}
