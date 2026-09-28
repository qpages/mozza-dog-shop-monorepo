import { cn } from "cn";
import { ImageUp, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { photoLabel } from "@/components/admin/format";
import {
  PhotoStrip,
  type PhotoStripHandle,
} from "@/components/admin/photo-strip";
import { quietCta, subtleText } from "@/components/admin/styles";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Shooting } from "@/lib/admin-client";

type Owner = Shooting["owners"][number];

type Props = {
  owner: Owner;
  archived: boolean;
  locked: boolean;
  removingDog: string | null;
  uploading: boolean;
  uploadLocked: boolean;
  deletingPhotos: boolean;
  onAddDog: (name: string) => Promise<boolean>;
  onRemoveDog: (name: string) => void;
  onUpload: (files: File[]) => void;
  onDeletePhotos: (photoIds: string[]) => void;
};

function listDogs(dogs: string[]) {
  if (dogs.length < 2) return dogs.join("");
  return `${dogs.slice(0, -1).join(", ")} et ${dogs.at(-1)}`;
}

export function OwnerRow({
  owner,
  archived,
  locked,
  removingDog,
  uploading,
  uploadLocked,
  deletingPhotos,
  onAddDog,
  onRemoveDog,
  onUpload,
  onDeletePhotos,
}: Props) {
  const [addingDog, setAddingDog] = useState(false);
  const [savingDog, setSavingDog] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const selectEntryRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<PhotoStripHandle>(null);
  const photos = photoLabel(owner.photoCount);

  return (
    <li className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <ul
            className="flex flex-wrap items-center gap-1.5"
            aria-label={`Chiens de ${owner.email}`}
          >
            {owner.dogs.map((dog) => (
              <li
                key={dog}
                className={cn(
                  "bg-canvas/10 text-ink inline-flex h-7 items-center rounded-full text-sm font-medium transition-opacity duration-200",
                  archived ? "px-2.5" : "pl-2.5 pr-0.5",
                  removingDog === dog && "opacity-50",
                )}
              >
                {dog}
                {archived ? null : (
                  <button
                    type="button"
                    aria-label={`Retirer ${dog}`}
                    disabled={locked || savingDog}
                    onClick={() => onRemoveDog(dog)}
                    className="text-ink/55 hover:bg-canvas/15 hover:text-ink focus-visible:ring-canvas/40 ml-0.5 grid size-6 place-items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
            {archived ? null : (
              <li>
                {addingDog ? (
                  <form
                    className="inline-flex"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (savingDog) return;
                      const data = new FormData(event.currentTarget);
                      setSavingDog(true);
                      try {
                        const ok = await onAddDog(
                          String(data.get("name") ?? ""),
                        );
                        if (ok) setAddingDog(false);
                      } finally {
                        setSavingDog(false);
                      }
                    }}
                  >
                    <label htmlFor={`dog-${owner.id}`} className="sr-only">
                      Nom du chien
                    </label>
                    <input
                      id={`dog-${owner.id}`}
                      name="name"
                      type="text"
                      required
                      maxLength={80}
                      autoFocus
                      enterKeyHint="done"
                      placeholder="Nom, puis Entrée"
                      disabled={savingDog}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setAddingDog(false);
                      }}
                      onBlur={(event) => {
                        if (!event.currentTarget.value.trim() && !savingDog) {
                          setAddingDog(false);
                        }
                      }}
                      className="bg-background placeholder:text-muted-foreground focus-visible:ring-3 border-canvas/40 focus-visible:border-canvas focus-visible:ring-canvas/15 h-7 w-40 rounded-full border px-3 text-sm outline-none transition-[border-color,box-shadow] duration-200"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    aria-label={`Ajouter un chien pour ${owner.email}`}
                    disabled={locked}
                    onClick={() => setAddingDog(true)}
                    className="border-canvas/45 text-canvas hover:border-canvas/70 hover:bg-canvas/6 focus-visible:ring-canvas/40 inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                    Chien
                  </button>
                )}
              </li>
            )}
          </ul>
          <p className={cn("truncate text-sm", subtleText)}>{owner.email}</p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          <span className={cn("text-sm font-normal tabular-nums", subtleText)}>
            {photos.charAt(0).toUpperCase() + photos.slice(1)}
          </span>
          {archived ? null : (
            <div className="flex items-center gap-2">
              <label
                aria-disabled={uploadLocked || selectMode || undefined}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  quietCta,
                  "has-focus-visible:ring-3 has-focus-visible:ring-canvas/25 cursor-pointer",
                  (uploadLocked || selectMode) &&
                    "border-canvas/30 bg-canvas/8 text-canvas/55 hover:bg-canvas/8 hover:text-canvas/55 pointer-events-none cursor-not-allowed",
                )}
              >
                <ImageUp />
                {uploading ? "Envoi…" : "Importer"}
                {uploading ? null : (
                  <span className="sr-only">
                    {` des photos pour ${listDogs(owner.dogs) || owner.email}`}
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  disabled={uploadLocked || selectMode}
                  onChange={(event) => {
                    const input = event.currentTarget;
                    const files = input.files ? [...input.files] : [];
                    input.value = "";
                    if (files.length > 0) onUpload(files);
                  }}
                />
              </label>
              {owner.photos.length > 0 ? (
                <Button
                  ref={selectEntryRef}
                  type="button"
                  variant="destructive"
                  data-select-entry
                  disabled={
                    deletingPhotos ||
                    uploadLocked ||
                    (selectMode && selectedCount === 0)
                  }
                  onClick={() => {
                    if (selectMode) stripRef.current?.confirmSelected();
                    else setSelectMode(true);
                  }}
                >
                  <Trash2 />
                  {deletingPhotos ? "Suppression…" : "Supprimer"}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {owner.photos.length > 0 ? (
        <PhotoStrip
          ref={stripRef}
          photos={owner.photos}
          archived={archived}
          deleting={deletingPhotos}
          selectMode={selectMode}
          idleFocusRef={selectEntryRef}
          onSelectModeChange={setSelectMode}
          onSelectedCountChange={setSelectedCount}
          onDelete={onDeletePhotos}
        />
      ) : null}
    </li>
  );
}
