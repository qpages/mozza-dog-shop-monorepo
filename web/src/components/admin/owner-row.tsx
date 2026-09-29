import { cn } from "cn";
import { Ellipsis, ImageUp, Trash2, UserMinus, X } from "lucide-react";
import { useRef, useState } from "react";
import { photoLabel } from "@/components/admin/format";
import { PhotoStrip } from "@/components/admin/photo-strip";
import { panelClass, quietCta, subtleText } from "@/components/admin/styles";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PHOTO_UPLOAD_REQUIRES_DOG_MESSAGE,
  type Shooting,
} from "@/lib/admin-client";

type Owner = Shooting["owners"][number];

type Props = {
  owner: Owner;
  archived: boolean;
  locked: boolean;
  removingDog: string | null;
  uploading: boolean;
  uploadLocked: boolean;
  deletingPhotos: boolean;
  removing: boolean;
  onAddDog: (name: string) => Promise<boolean>;
  onRemoveDog: (name: string) => void;
  onUpload: (files: File[]) => void;
  onDeletePhotos: (photoIds: string[]) => void;
  onRemove: () => void;
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
  removing,
  onAddDog,
  onRemoveDog,
  onUpload,
  onDeletePhotos,
  onRemove,
}: Props) {
  const [addingDog, setAddingDog] = useState(false);
  const [savingDog, setSavingDog] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const selectEntryRef = useRef<HTMLButtonElement>(null);
  const canImportPhotos = owner.dogs.length > 0;
  const busy = locked || savingDog || uploading || deletingPhotos || removing;
  const showPhotoCount = owner.photoCount > 0;

  return (
    <li
      className={cn(
        panelClass,
        "relative flex flex-col gap-4 px-5 py-4 transition-opacity duration-200",
        showPhotoCount && "pr-12",
        removing && "opacity-50",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="type-section truncate">{owner.email}</h2>
          <ul
            className="flex flex-wrap items-center gap-1.5"
            aria-label={`Chiens de ${owner.email}`}
          >
            {owner.dogs.map((dog) => (
              <li
                key={dog}
                className={cn(
                  "bg-canvas/10 text-ink inline-flex h-6 items-center rounded-full text-xs font-medium transition-opacity duration-200",
                  archived ? "px-2.5" : "pl-2.5 pr-0.5",
                  removingDog === dog && "opacity-50",
                )}
              >
                {dog}
                {archived ? null : (
                  <button
                    type="button"
                    aria-label={`Retirer ${dog}`}
                    disabled={locked || savingDog || removing}
                    onClick={() => onRemoveDog(dog)}
                    className="text-ink/55 hover:bg-canvas/15 hover:text-ink focus-visible:ring-canvas/40 ml-0.5 grid size-5 place-items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <X className="size-3" />
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
                      className="bg-background placeholder:text-muted-foreground focus-visible:ring-3 border-canvas/40 focus-visible:border-canvas focus-visible:ring-canvas/15 h-6 w-40 rounded-full border px-3 text-xs outline-none transition-[border-color,box-shadow] duration-200"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    aria-label={`Ajouter un chien pour ${owner.email}`}
                    disabled={locked || removing}
                    onClick={() => setAddingDog(true)}
                    className="border-canvas/45 text-canvas hover:border-canvas/70 hover:bg-canvas/6 focus-visible:ring-canvas/40 inline-flex h-6 items-center rounded-full border border-dashed px-2.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40"
                  >
                    + Ajouter un chien
                  </button>
                )}
              </li>
            )}
          </ul>
          {!archived && !canImportPhotos ? (
            <p className={cn("max-w-prose text-sm", subtleText)}>
              {PHOTO_UPLOAD_REQUIRES_DOG_MESSAGE}
            </p>
          ) : null}
        </div>
        {archived ? null : (
          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            <label
              aria-disabled={
                uploadLocked ||
                selectMode ||
                removing ||
                !canImportPhotos ||
                undefined
              }
              title={
                !canImportPhotos ? PHOTO_UPLOAD_REQUIRES_DOG_MESSAGE : undefined
              }
              className={cn(
                buttonVariants({ variant: "outline" }),
                quietCta,
                "has-focus-visible:ring-3 has-focus-visible:ring-canvas/25 cursor-pointer",
                (uploadLocked || selectMode || removing || !canImportPhotos) &&
                  "border-canvas/30 bg-canvas/8 text-canvas/55 hover:bg-canvas/8 hover:text-canvas/55 pointer-events-none cursor-not-allowed",
              )}
            >
              <ImageUp />
              {uploading ? "Envoi…" : "Importer des photos"}
              {uploading ? null : (
                <span className="sr-only">
                  {` pour ${listDogs(owner.dogs) || owner.email}`}
                </span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={
                  uploadLocked || selectMode || removing || !canImportPhotos
                }
                onChange={(event) => {
                  const input = event.currentTarget;
                  const files = input.files ? [...input.files] : [];
                  input.value = "";
                  if (files.length > 0) onUpload(files);
                }}
              />
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={busy}
                render={
                  <Button
                    ref={selectEntryRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label={`Actions de ${owner.email}`}
                    className="text-ink/55 hover:bg-canvas/10 hover:text-ink aria-expanded:bg-canvas/10 aria-expanded:text-ink"
                  />
                }
              >
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {owner.photos.length > 0 ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setSelectMode(true)}
                  >
                    <Trash2 />
                    Supprimer des photos
                  </DropdownMenuItem>
                ) : null}
                {owner.photos.length > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem variant="destructive" onClick={onRemove}>
                  <UserMinus />
                  Retirer du shooting
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {showPhotoCount ? (
        <span
          aria-label={photoLabel(owner.photoCount)}
          className={cn(
            "pointer-events-none absolute bottom-4 right-5 text-sm tabular-nums",
            subtleText,
          )}
        >
          {owner.photoCount}
        </span>
      ) : null}
      {owner.photos.length > 0 ? (
        <PhotoStrip
          photos={owner.photos}
          archived={archived}
          deleting={deletingPhotos}
          selectMode={selectMode}
          idleFocusRef={selectEntryRef}
          onSelectModeChange={setSelectMode}
          onDelete={onDeletePhotos}
        />
      ) : null}
    </li>
  );
}
