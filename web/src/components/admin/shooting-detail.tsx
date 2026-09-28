import { cn } from "cn";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  Ellipsis,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShootingMeta } from "@/components/admin/shooting-meta";
import { OwnerRow } from "@/components/admin/owner-row";
import {
  fieldClass,
  panelClass,
  quietCta,
  subtleText,
} from "@/components/admin/styles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addDogs,
  addShootingOwner,
  deletePhotos,
  removeDog,
  updateShooting,
  uploadPhotos,
  type Shooting,
} from "@/lib/admin-client";

type Props = {
  shooting: Shooting;
  archiving: boolean;
  onBack: () => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
  onChanged: () => void;
};

export function ShootingDetail({
  shooting,
  archiving,
  onBack,
  onArchive,
  onDelete,
  onChanged,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [uploadingOwnerId, setUploadingOwnerId] = useState<string | null>(null);
  const [deletingOwnerId, setDeletingOwnerId] = useState<string | null>(null);
  const empty = shooting.owners.length === 0;
  const showForm = !shooting.archived && (formOpen || empty);

  useEffect(() => {
    heading.current?.focus();
  }, [shooting.id]);

  async function saveDog(
    trimmed: string,
    run: () => Promise<
      { added: string[]; skipped: string[] } | "duplicate" | "error"
    >,
  ) {
    if (!trimmed) {
      toast.error("Indique un nom de chien.");
      return false;
    }
    try {
      const result = await run();
      if (result === "duplicate") {
        toast.error("Ce chien est déjà associé à ce maître.");
        return false;
      }
      if (result === "error") {
        toast.error("Impossible d'ajouter le chien.");
        return false;
      }
      toast.success(`${trimmed} ajouté.`);
      onChanged();
      return true;
    } catch {
      toast.error("Impossible d'ajouter le chien.");
      return false;
    }
  }

  function addOwner(email: string, name: string) {
    const trimmed = name.trim();
    return saveDog(trimmed, () =>
      addShootingOwner(shooting.id, { email, names: [trimmed] }),
    );
  }

  function addDog(ownerId: string, name: string) {
    const trimmed = name.trim();
    return saveDog(trimmed, () => addDogs(ownerId, [trimmed]));
  }

  async function onRemoveDog(ownerId: string, name: string) {
    if (removingKey) return;
    setRemovingKey(`${ownerId}:${name}`);
    try {
      const result = await removeDog(ownerId, name);
      if (result === "error") {
        toast.error("Impossible de retirer le chien.");
        return;
      }
      toast.success(`${name} retiré.`);
      onChanged();
    } catch {
      toast.error("Impossible de retirer le chien.");
    } finally {
      setRemovingKey(null);
    }
  }

  async function onUpload(ownerId: string, files: File[]) {
    if (uploadingOwnerId) return;
    setUploadingOwnerId(ownerId);
    try {
      const { added, failures } = await uploadPhotos(
        shooting.id,
        ownerId,
        files,
      );
      for (const failure of failures) {
        toast.error(failure.message);
      }
      if (added > 0) {
        toast.success(
          added === 1 ? "1 photo ajoutée." : `${added} photos ajoutées.`,
        );
        onChanged();
      }
    } catch {
      toast.error("Impossible d'ajouter la/les photos.");
    } finally {
      setUploadingOwnerId(null);
    }
  }

  async function onDeletePhotos(ownerId: string, photoIds: string[]) {
    if (deletingOwnerId || photoIds.length === 0) return;
    setDeletingOwnerId(ownerId);
    try {
      const result = await deletePhotos(shooting.id, ownerId, photoIds);
      if (result === "error") {
        toast.error("Impossible de supprimer les photos.");
        return;
      }
      toast.success(
        photoIds.length === 1
          ? "1 photo supprimée."
          : `${photoIds.length} photos supprimées.`,
      );
      onChanged();
    } catch {
      toast.error("Impossible de supprimer les photos.");
    } finally {
      setDeletingOwnerId(null);
    }
  }

  async function onSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const shotOn = String(data.get("shotOn") ?? "");
    if (!name) {
      toast.error("Indique un nom de shooting.");
      return;
    }
    setSaving(true);
    setEditOpen(false);
    try {
      const ok = await updateShooting(shooting.id, { name, shotOn });
      if (!ok) {
        toast.error("Impossible de modifier le shooting.");
        return;
      }
      toast.success("Shooting modifié.");
      onChanged();
    } catch {
      toast.error("Impossible de modifier le shooting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="text-paper flex flex-col gap-3">
        <a
          href="/admin"
          className="admin-link inline-flex w-fit items-center gap-1"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            onBack();
          }}
        >
          <ChevronLeft className="size-4" />
          Shootings
        </a>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1
              ref={heading}
              tabIndex={-1}
              className="type-display text-balance outline-none"
            >
              {shooting.name}
            </h1>
            <ShootingMeta shooting={shooting} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {showForm || shooting.archived ? null : (
              <Button
                type="button"
                size="lg"
                className="bg-paper text-canvas px-3 hover:bg-white"
                onClick={() => setFormOpen(true)}
              >
                <Plus />
                Ajouter un chien
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label="Actions du shooting"
                    className="text-paper hover:bg-paper/10 hover:text-paper aria-expanded:bg-paper/10 aria-expanded:text-paper"
                  />
                }
              >
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil />
                  Modifier
                </DropdownMenuItem>
                {shooting.archived ? null : (
                  <DropdownMenuItem
                    disabled={archiving}
                    onClick={() => onArchive(true)}
                  >
                    <Archive />
                    Archiver
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <section className={panelClass} aria-label="Chiens du shooting">
        {shooting.archived ? (
          <div className="border-ink/10 bg-ink/3 flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-medium">Shooting archivé.</span>{" "}
              <span className={subtleText}>
                Les maîtres ne voient plus ces photos.
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              className={cn(quietCta, "self-start sm:self-auto")}
              disabled={archiving}
              onClick={() => onArchive(false)}
            >
              <ArchiveRestore />
              {archiving ? "Remise…" : "Remettre en ligne"}
            </Button>
          </div>
        ) : null}

        {empty && !shooting.archived ? (
          <div className="px-5 pt-5">
            <p className="font-medium">Aucun chien pour l'instant</p>
            <p className={cn("mt-1 max-w-prose text-sm", subtleText)}>
              Ajoute chaque chien avec l'e-mail de son maître. Il retrouvera ses
              photos avec cet e-mail.
            </p>
          </div>
        ) : null}

        {empty ? null : (
          <ul className="divide-ink/10 divide-y">
            {shooting.owners.map((owner) => (
              <OwnerRow
                key={owner.id}
                owner={owner}
                archived={shooting.archived}
                locked={removingKey !== null}
                removingDog={
                  removingKey?.startsWith(`${owner.id}:`)
                    ? removingKey.slice(owner.id.length + 1)
                    : null
                }
                uploading={uploadingOwnerId === owner.id}
                uploadLocked={uploadingOwnerId !== null}
                deletingPhotos={deletingOwnerId === owner.id}
                onAddDog={(name) => addDog(owner.id, name)}
                onRemoveDog={(name) => void onRemoveDog(owner.id, name)}
                onUpload={(files) => void onUpload(owner.id, files)}
                onDeletePhotos={(photoIds) =>
                  void onDeletePhotos(owner.id, photoIds)
                }
              />
            ))}
          </ul>
        )}

        {showForm ? (
          <form
            className={cn(
              "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end",
              !empty && "border-ink/10 bg-canvas/5 border-t",
            )}
            onSubmit={async (event) => {
              event.preventDefault();
              if (addingNew) return;
              const form = event.currentTarget;
              const data = new FormData(form);
              setAddingNew(true);
              try {
                const ok = await addOwner(
                  String(data.get("email") ?? ""),
                  String(data.get("name") ?? ""),
                );
                if (!ok) return;
                setFormOpen(true);
                form.reset();
                (form.elements.namedItem("name") as HTMLInputElement).focus();
              } finally {
                setAddingNew(false);
              }
            }}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <label
                htmlFor={`new-dog-${shooting.id}`}
                className="text-sm font-medium"
              >
                Chien
              </label>
              <input
                id={`new-dog-${shooting.id}`}
                name="name"
                type="text"
                required
                maxLength={80}
                autoFocus={!empty}
                placeholder="Médor"
                className={fieldClass}
              />
            </div>
            <div className="flex flex-[1.4] flex-col gap-1.5">
              <label
                htmlFor={`new-email-${shooting.id}`}
                className="text-sm font-medium"
              >
                E-mail du maître
              </label>
              <input
                id={`new-email-${shooting.id}`}
                name="email"
                type="email"
                required
                placeholder="maitre@email.com"
                className={fieldClass}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="lg" disabled={addingNew}>
                {addingNew ? "Ajout…" : "Ajouter"}
              </Button>
              {empty ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => setFormOpen(false)}
                >
                  Fermer
                </Button>
              )}
            </div>
          </form>
        ) : null}

        {empty && shooting.archived ? (
          <p className={cn("px-5 py-4 text-sm", subtleText)}>
            Aucun chien sur ce shooting.
          </p>
        ) : null}
      </section>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open && !saving) setEditOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le shooting</DialogTitle>
            <DialogDescription>
              Mets à jour le nom et la date de la séance.
            </DialogDescription>
          </DialogHeader>
          <form
            id={`edit-shooting-${shooting.id}`}
            className="flex flex-col gap-3"
            onSubmit={(event) => void onSaveEdit(event)}
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`edit-name-${shooting.id}`}
                className="text-sm font-medium"
              >
                Nom
              </label>
              <input
                id={`edit-name-${shooting.id}`}
                name="name"
                type="text"
                required
                maxLength={80}
                defaultValue={shooting.name}
                key={`${shooting.id}-name-${editOpen}`}
                placeholder="Séance du dimanche"
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`edit-shot-on-${shooting.id}`}
                className="text-sm font-medium"
              >
                Date
              </label>
              <input
                id={`edit-shot-on-${shooting.id}`}
                name="shotOn"
                type="date"
                required
                defaultValue={shooting.shotOn}
                key={`${shooting.id}-date-${editOpen}`}
                className={fieldClass}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={quietCta}
              disabled={saving}
              onClick={() => setEditOpen(false)}
            >
              Fermer
            </Button>
            <Button
              type="submit"
              form={`edit-shooting-${shooting.id}`}
              disabled={saving}
            >
              {saving ? "Modification…" : "Modifier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
