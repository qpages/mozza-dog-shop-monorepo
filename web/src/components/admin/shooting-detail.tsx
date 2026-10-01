import { cn } from "cn";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  Ellipsis,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { matchesOwnerSearch } from "@/components/admin/match-owner";
import { ShootingMeta } from "@/components/admin/shooting-meta";
import { OwnerEmailField } from "@/components/admin/owner-email-field";
import { OwnerRow } from "@/components/admin/owner-row";
import {
  fieldClass,
  panelClass,
  quietCta,
  subtleText,
  touchControl,
  touchControlLg,
  touchIcon,
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
  changeOwnerEmail,
  deletePhotos,
  reorderPhotos,
  removeDog,
  removeShootingOwner,
  updateShooting,
  PHOTO_UPLOAD_REQUIRES_DOG_MESSAGE,
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
  const [ownerEmail, setOwnerEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [uploadingOwnerId, setUploadingOwnerId] = useState<string | null>(null);
  const [deletingOwnerId, setDeletingOwnerId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<
    Shooting["owners"][number] | null
  >(null);
  const [removingOwnerId, setRemovingOwnerId] = useState<string | null>(null);
  const [ownerQuery, setOwnerQuery] = useState("");
  const empty = shooting.owners.length === 0;
  const showForm = !shooting.archived && (formOpen || empty);
  const visibleOwners = useMemo(
    () =>
      shooting.owners.filter((owner) => matchesOwnerSearch(owner, ownerQuery)),
    [ownerQuery, shooting.owners],
  );

  useEffect(() => {
    heading.current?.focus();
    setOwnerQuery("");
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
        toast.error("Ce chien est déjà associé à ce participant.");
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

  async function addOwner(email: string) {
    try {
      const result = await addShootingOwner(shooting.id, { email });
      if (result === "duplicate") {
        toast.error("Ce participant est déjà sur ce shooting.");
        return false;
      }
      if (result === "error") {
        toast.error("Impossible d'ajouter le participant.");
        return false;
      }
      toast.success("Participant ajouté.");
      onChanged();
      return true;
    } catch {
      toast.error("Impossible d'ajouter le participant.");
      return false;
    }
  }

  async function onChangeEmail(ownerId: string, email: string) {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Indique un e-mail valide.";
    }
    try {
      const result = await changeOwnerEmail(shooting.id, ownerId, trimmed);
      if (result === "taken") {
        return "Cet e-mail appartient déjà à un autre participant.";
      }
      if (result === "error") return "Impossible de modifier l'e-mail.";
      toast.success("E-mail modifié.");
      onChanged();
      return null;
    } catch {
      return "Impossible de modifier l'e-mail.";
    }
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
    const owner = shooting.owners.find((row) => row.id === ownerId);
    if (!owner || owner.dogs.length === 0) {
      toast.error(PHOTO_UPLOAD_REQUIRES_DOG_MESSAGE);
      return;
    }
    setUploadingOwnerId(ownerId);
    const uploadToast = toast.loading("Téléchargement en cours…");
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
          { id: uploadToast },
        );
        onChanged();
      } else {
        toast.dismiss(uploadToast);
      }
    } catch {
      toast.error("Impossible d'ajouter la/les photos.", { id: uploadToast });
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

  async function onReorderPhotos(ownerId: string, photoIds: string[]) {
    if (photoIds.length < 2) return false;
    try {
      const result = await reorderPhotos(shooting.id, ownerId, photoIds);
      if (result === "error") {
        toast.error("Impossible de changer l'ordre des photos.");
        return false;
      }
      return true;
    } catch {
      toast.error("Impossible de changer l'ordre des photos.");
      return false;
    }
  }

  async function onRemoveOwner() {
    if (!pendingRemove || removingOwnerId) return;
    setRemovingOwnerId(pendingRemove.id);
    try {
      const result = await removeShootingOwner(shooting.id, pendingRemove.id);
      if (result === "error") {
        toast.error("Impossible de retirer le participant.");
        return;
      }
      toast.success("Participant retiré.");
      setPendingRemove(null);
      onChanged();
    } catch {
      toast.error("Impossible de retirer le participant.");
    } finally {
      setRemovingOwnerId(null);
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
          className="admin-link inline-flex min-h-11 w-fit touch-manipulation items-center gap-1.5 py-2 text-base sm:min-h-0 sm:py-0 sm:text-sm"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            onBack();
          }}
        >
          <ChevronLeft className="size-4" />
          Shootings
        </a>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1
              ref={heading}
              tabIndex={-1}
              className="type-display text-balance outline-none max-sm:text-2xl max-sm:leading-tight"
            >
              {shooting.name}
            </h1>
            <ShootingMeta shooting={shooting} />
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
            {showForm || shooting.archived ? null : (
              <Button
                type="button"
                size="lg"
                className={`flex-1 px-3 sm:flex-none ${touchControlLg}`}
                onClick={() => setFormOpen(true)}
              >
                <Plus />
                Ajouter un participant
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Actions du shooting"
                    className={`text-paper/70 hover:bg-paper/10 hover:text-paper aria-expanded:bg-paper/10 aria-expanded:text-paper ml-auto ${touchIcon}`}
                  />
                }
              >
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
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

      <section
        className="flex flex-col gap-4"
        aria-label="Participants du shooting"
      >
        {shooting.archived ? (
          <div
            className={cn(
              panelClass,
              "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
            )}
          >
            <p className="text-sm">
              <span className="font-medium">Shooting archivé.</span>{" "}
              <span className={subtleText}>
                Les participants ne voient plus ces photos.
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              className={cn(
                quietCta,
                touchControl,
                "self-stretch sm:self-auto",
              )}
              disabled={archiving}
              onClick={() => onArchive(false)}
            >
              <ArchiveRestore />
              {archiving ? "Remise…" : "Remettre en ligne"}
            </Button>
          </div>
        ) : null}

        {showForm ? (
          <div className={panelClass}>
            {empty ? (
              <div className="px-5 pt-5">
                <p className="font-medium">Aucun participant pour l'instant</p>
                <p className={cn("mt-1 max-w-prose text-sm", subtleText)}>
                  Ajoute un participant par e-mail, puis ses chiens depuis sa
                  ligne. Il retrouvera ses photos avec cet e-mail.
                </p>
              </div>
            ) : null}
            <form
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end"
              onSubmit={async (event) => {
                event.preventDefault();
                if (addingNew) return;
                const email = ownerEmail.trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                  toast.error("Choisis un participant ou saisis son e-mail.");
                  return;
                }
                setAddingNew(true);
                try {
                  const ok = await addOwner(email);
                  if (!ok) return;
                  setFormOpen(true);
                  setOwnerEmail("");
                  emailRef.current?.focus();
                } finally {
                  setAddingNew(false);
                }
              }}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label
                  htmlFor={`new-email-${shooting.id}`}
                  className="text-base font-medium sm:text-sm"
                >
                  E-mail du participant
                </label>
                <OwnerEmailField
                  id={`new-email-${shooting.id}`}
                  value={ownerEmail}
                  onValueChange={setOwnerEmail}
                  excludeEmails={shooting.owners.map((owner) => owner.email)}
                  disabled={addingNew}
                  autoFocus={!empty}
                  inputRef={emailRef}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  size="lg"
                  disabled={addingNew}
                  className={`w-full sm:w-auto ${touchControlLg}`}
                >
                  {addingNew ? "Ajout…" : "Ajouter"}
                </Button>
                {empty ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className={`w-full sm:w-auto ${touchControlLg}`}
                    onClick={() => {
                      setOwnerEmail("");
                      setFormOpen(false);
                    }}
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </form>
          </div>
        ) : null}

        {empty ? null : (
          <>
            <OwnerSearch
              id={`owner-search-${shooting.id}`}
              value={ownerQuery}
              onValueChange={setOwnerQuery}
            />
            {visibleOwners.length === 0 ? (
              <p className={cn(panelClass, "px-5 py-4 text-sm", subtleText)}>
                Aucun participant ne correspond à cette recherche.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {visibleOwners.map((owner) => (
                  <OwnerRow
                    key={owner.id}
                    owner={owner}
                    archived={shooting.archived}
                    locked={removingKey !== null || removingOwnerId !== null}
                    removingDog={
                      removingKey?.startsWith(`${owner.id}:`)
                        ? removingKey.slice(owner.id.length + 1)
                        : null
                    }
                    uploading={uploadingOwnerId === owner.id}
                    uploadLocked={uploadingOwnerId !== null}
                    deletingPhotos={deletingOwnerId === owner.id}
                    removing={removingOwnerId === owner.id}
                    onAddDog={(name) => addDog(owner.id, name)}
                    onRemoveDog={(name) => void onRemoveDog(owner.id, name)}
                    onUpload={(files) => void onUpload(owner.id, files)}
                    onDeletePhotos={(photoIds) =>
                      void onDeletePhotos(owner.id, photoIds)
                    }
                    onReorderPhotos={(photoIds) =>
                      onReorderPhotos(owner.id, photoIds)
                    }
                    onReorderDone={onChanged}
                    onChangeEmail={(email) => onChangeEmail(owner.id, email)}
                    onRemove={() => setPendingRemove(owner)}
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {empty && shooting.archived ? (
          <p className={cn(panelClass, "px-5 py-4 text-sm", subtleText)}>
            Aucun participant sur ce shooting.
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
                className="text-base font-medium sm:text-sm"
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
                className="text-base font-medium sm:text-sm"
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
              Annuler
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

      <Dialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open && !removingOwnerId) setPendingRemove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer ce participant ?</DialogTitle>
            <DialogDescription>
              {pendingRemove ? removeOwnerMessage(pendingRemove) : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={quietCta}
              disabled={removingOwnerId !== null}
              onClick={() => setPendingRemove(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removingOwnerId !== null}
              onClick={() => void onRemoveOwner()}
            >
              {removingOwnerId ? "Retrait…" : "Retirer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OwnerSearch({
  id,
  value,
  onValueChange,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        panelClass,
        "focus-within:ring-3 focus-within:ring-canvas/15 relative",
      )}
    >
      <Search
        aria-hidden
        className="text-ink/45 pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2"
      />
      <label htmlFor={id} className="sr-only">
        Rechercher par e-mail ou nom du chien
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        placeholder="E-mail ou nom du chien"
        className={cn(
          "placeholder:text-ink/45 h-12 min-h-12 w-full bg-transparent pl-11 pr-4 text-base outline-none sm:h-11 sm:min-h-11 sm:text-sm",
          value && "pr-12 sm:pr-10",
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => onValueChange("")}
          className="text-ink/50 hover:bg-canvas/10 hover:text-ink focus-visible:ring-canvas/40 absolute right-1 top-1/2 grid size-11 -translate-y-1/2 touch-manipulation place-items-center rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 sm:size-8"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function removeOwnerMessage(owner: Shooting["owners"][number]) {
  if (owner.photoCount === 0) {
    return `${owner.email} sera retiré de ce shooting. Tu pourras le rajouter plus tard.`;
  }
  if (owner.photoCount === 1) {
    return `${owner.email} et sa photo seront retirés de ce shooting. La photo sera supprimée définitivement.`;
  }
  return `${owner.email} et ses ${owner.photoCount} photos seront retirés de ce shooting. Les photos seront supprimées définitivement.`;
}
