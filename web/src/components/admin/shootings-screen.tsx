import { useEffect, useState } from "react";
import { toast } from "sonner";
import { photoTotal } from "@/components/admin/format";
import { ShootingDetail } from "@/components/admin/shooting-detail";
import { ListSkeleton, ShootingList } from "@/components/admin/shooting-list";
import { panelClass, quietCta } from "@/components/admin/styles";
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
  deleteShooting,
  listShootings,
  setShootingArchived,
  type Shooting,
} from "@/lib/admin-client";

function readShootingId() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("shooting");
}

function deleteMessage(shooting: Shooting) {
  const photos = photoTotal(shooting);
  if (photos === 0) return `« ${shooting.name} » sera supprimé définitivement.`;
  const what = photos === 1 ? "sa photo" : `ses ${photos} photos`;
  return `« ${shooting.name} » et ${what} seront supprimés définitivement.`;
}

export function ShootingsScreen() {
  const [shootings, setShootings] = useState<Shooting[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(readShootingId);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Shooting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const opened = openId
    ? shootings?.find((shooting) => shooting.id === openId)
    : undefined;

  useEffect(() => {
    let cancelled = false;

    async function loadShootings() {
      const next = await listShootings();
      if (cancelled) return;
      if (next === null) {
        setShootings([]);
        toast.error("Impossible de charger les shootings.");
        return;
      }
      setShootings(next);
    }

    void loadShootings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onPopState = () => setOpenId(readShootingId());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (shootings && openId && !opened) navigate(null, true);
  }, [shootings, openId, opened]);

  function navigate(id: string | null, replace = false) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("shooting", id);
    else url.searchParams.delete("shooting");
    if (replace) window.history.replaceState({}, "", url);
    else window.history.pushState({}, "", url);
    setOpenId(id);
    window.scrollTo({ top: 0 });
  }

  async function reloadShootings() {
    const next = await listShootings();
    if (next === null) {
      toast.error("Impossible de recharger les shootings.");
      return;
    }
    setShootings(next);
  }

  async function setArchived(shooting: Shooting, archived: boolean) {
    if (archivingId) return;
    setArchivingId(shooting.id);
    const failure = archived
      ? "Impossible d'archiver le shooting."
      : "Impossible de remettre le shooting en ligne.";
    try {
      const ok = await setShootingArchived(shooting.id, archived);
      if (!ok) {
        toast.error(failure);
        return;
      }
      setShootings(
        (current) =>
          current?.map((item) =>
            item.id === shooting.id ? { ...item, archived } : item,
          ) ?? null,
      );
      if (archived) {
        toast.success(`« ${shooting.name} » archivé.`, {
          action: {
            label: "Annuler",
            onClick: () => void setArchived(shooting, false),
          },
        });
        navigate(null);
      } else {
        toast.success(`« ${shooting.name} » remis en ligne.`);
      }
      await reloadShootings();
    } catch {
      toast.error(failure);
    } finally {
      setArchivingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const ok = await deleteShooting(pendingDelete.id);
      if (!ok) {
        toast.error("Impossible de supprimer le shooting.");
        return;
      }
      toast.success("Shooting supprimé.");
      if (openId === pendingDelete.id) navigate(null, true);
      setPendingDelete(null);
      await reloadShootings();
    } catch {
      toast.error("Impossible de supprimer le shooting.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <main className="admin-rise mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pb-16 pt-4">
        {opened ? (
          <ShootingDetail
            key={opened.id}
            shooting={opened}
            archiving={archivingId === opened.id}
            onBack={() => navigate(null)}
            onArchive={(archived) => void setArchived(opened, archived)}
            onDelete={() => setPendingDelete(opened)}
            onChanged={() => void reloadShootings()}
          />
        ) : null}
        {openId && shootings === null ? (
          <div className={panelClass}>
            <ListSkeleton />
          </div>
        ) : null}
        {openId ? null : (
          <ShootingList
            shootings={shootings}
            showArchived={showArchived}
            onShowArchivedChange={setShowArchived}
            onOpen={(id) => navigate(id)}
            onCreated={async (id) => {
              await reloadShootings();
              navigate(id);
            }}
          />
        )}
      </main>
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce shooting ?</DialogTitle>
            <DialogDescription>
              {pendingDelete ? deleteMessage(pendingDelete) : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={quietCta}
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
