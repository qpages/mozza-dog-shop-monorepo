import { cn } from "cn";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  Ellipsis,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addDogs,
  removeDog,
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
  const [addingNew, setAddingNew] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [uploadingOwnerId, setUploadingOwnerId] = useState<string | null>(null);
  const empty = shooting.owners.length === 0;
  const showForm = !shooting.archived && (formOpen || empty);

  useEffect(() => {
    heading.current?.focus();
  }, [shooting.id]);

  async function addDog(email: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Indique un nom de chien.");
      return false;
    }
    try {
      const result = await addDogs(shooting.id, {
        email,
        names: [trimmed],
      });
      if (result === "duplicate") {
        toast.error("Ce chien est déjà sur ce shooting.");
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

  async function onRemoveDog(ownerId: string, name: string) {
    if (removingKey) return;
    setRemovingKey(`${ownerId}:${name}`);
    try {
      const result = await removeDog(shooting.id, ownerId, name);
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
      toast.error("Impossible d'envoyer les photos.");
    } finally {
      setUploadingOwnerId(null);
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
                onAddDog={(name) => addDog(owner.email, name)}
                onRemoveDog={(name) => void onRemoveDog(owner.id, name)}
                onUpload={(files) => void onUpload(owner.id, files)}
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
                const ok = await addDog(
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
    </>
  );
}
