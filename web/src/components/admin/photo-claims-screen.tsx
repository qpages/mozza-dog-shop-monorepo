import { cn } from "cn";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ActiveClaimCount } from "@/components/admin/claim-meta";
import { claimDisplayName, formatDate } from "@/components/admin/format";
import { PhotoClaimsTable } from "@/components/admin/photo-claims-table";
import { ListSkeleton } from "@/components/admin/shooting-list";
import {
  quietCta,
  touchControl,
  touchControlLg,
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
  deletePhotoClaim,
  deletePhotoClaims,
  listPhotoClaims,
  setPhotoClaimArchived,
  type PhotoClaim,
} from "@/lib/admin-client";

function deleteMessage(claim: PhotoClaim) {
  return `« ${claimDisplayName(claim)} » (shooting du ${formatDate(claim.shootingDate)}) sera supprimé définitivement.`;
}

export function PhotoClaimsScreen() {
  const heading = useRef<HTMLHeadingElement>(null);
  const selectEntryRef = useRef<HTMLButtonElement>(null);
  const [claims, setClaims] = useState<PhotoClaim[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PhotoClaim | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCount, setConfirmCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const skipFocus = useRef(false);
  const wasSelecting = useRef(false);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (!skipFocus.current && !selectMode && wasSelecting.current) {
      selectEntryRef.current?.focus();
    }
    skipFocus.current = false;
    wasSelecting.current = selectMode;
  }, [selectMode]);

  useEffect(() => {
    if (!selectMode) setSelected(new Set());
  }, [selectMode]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const next = await listPhotoClaims({ status: "all" });
      if (cancelled) return;
      if (next === null) {
        setClaims([]);
        toast.error("Impossible de charger les signalements.");
        return;
      }
      setClaims(next.claims);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    const next = await listPhotoClaims({ status: "all" });
    if (next === null) {
      toast.error("Impossible de recharger les signalements.");
      return;
    }
    setClaims(next.claims);
  }

  async function setArchived(claim: PhotoClaim, archived: boolean) {
    if (busyId) return;
    setBusyId(claim.id);
    const failure = archived
      ? "Impossible de valider le signalement."
      : "Impossible de remettre le signalement en ligne.";
    try {
      const ok = await setPhotoClaimArchived(claim.id, archived);
      if (!ok) {
        toast.error(failure);
        return;
      }
      setClaims(
        (current) =>
          current?.map((item) =>
            item.id === claim.id
              ? { ...item, status: archived ? "archived" : "open" }
              : item,
          ) ?? null,
      );
      if (archived) {
        toast.success("Signalement validé.", {
          action: {
            label: "Annuler",
            onClick: () => void setArchived(claim, false),
          },
        });
      } else {
        toast.success(`« ${claim.email} » remis en ligne.`);
      }
      await reload();
    } catch {
      toast.error(failure);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const ok = await deletePhotoClaim(pendingDelete.id);
      if (!ok) {
        toast.error("Impossible de supprimer le signalement.");
        return;
      }
      toast.success("Signalement supprimé.");
      setPendingDelete(null);
      await reload();
    } catch {
      toast.error("Impossible de supprimer le signalement.");
    } finally {
      setDeleting(false);
    }
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
    setSelectMode(false);
  }

  function openBulkConfirm() {
    if (selected.size === 0 || deleting) return;
    setConfirmCount(selected.size);
    setConfirmOpen(true);
  }

  async function confirmBulkDelete() {
    const ids = [...selected];
    setConfirmOpen(false);
    skipFocus.current = true;
    exitSelect();
    setDeleting(true);
    try {
      const ok = await deletePhotoClaims(ids);
      if (!ok) {
        toast.error("Impossible de supprimer les signalements.");
        return;
      }
      toast.success(
        ids.length === 1 ? "Signalement supprimé." : "Signalements supprimés.",
      );
      await reload();
    } catch {
      toast.error("Impossible de supprimer les signalements.");
    } finally {
      setDeleting(false);
    }
  }

  const loading = claims === null;
  const open = claims?.filter((claim) => claim.status === "open") ?? [];
  const archived = claims?.filter((claim) => claim.status === "archived") ?? [];
  const selectable = showArchived ? [...open, ...archived] : open;
  const count = selected.size;
  const allSelected =
    count > 0 && selectable.every((claim) => selected.has(claim.id));
  const hasClaims = open.length + archived.length > 0;

  return (
    <>
      <main className="admin-rise mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 pb-[max(4rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
        <div className="text-paper flex flex-col gap-3">
          <a
            href="/admin"
            className="admin-link inline-flex min-h-11 w-fit touch-manipulation items-center gap-1.5 py-2 text-base sm:min-h-0 sm:py-0 sm:text-sm"
          >
            <ChevronLeft className="size-4" />
            Shootings
          </a>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h1
                ref={heading}
                tabIndex={-1}
                className="type-display outline-none max-sm:text-2xl max-sm:leading-tight"
              >
                Signalements
              </h1>
              {loading ? null : <ActiveClaimCount count={open.length} />}
            </div>
            {selectMode || !hasClaims ? null : (
              <Button
                ref={selectEntryRef}
                type="button"
                variant="destructive"
                size="lg"
                className={`bg-paper hover:bg-paper/90 w-full px-3 sm:w-auto ${touchControlLg}`}
                onClick={() => setSelectMode(true)}
              >
                <Trash2 />
                Supprimer des signalements
              </Button>
            )}
          </div>
        </div>

        {selectMode ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
            <span
              role="status"
              aria-live="polite"
              className="text-paper/80 grid text-sm tabular-nums"
            >
              <span className="invisible col-start-1 row-start-1" aria-hidden>
                Sélectionnez des signalements
              </span>
              <span className="col-start-1 row-start-1">
                {count === 0
                  ? "Sélectionnez des signalements"
                  : `${count} sélectionné${count > 1 ? "s" : ""}`}
              </span>
            </span>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`text-paper/70 hover:bg-paper/10 hover:text-paper w-full justify-center sm:w-auto ${touchControl}`}
                onClick={() =>
                  setSelected(
                    allSelected
                      ? new Set()
                      : new Set(selectable.map((claim) => claim.id)),
                  )
                }
              >
                <span className="inline-grid">
                  <span
                    className="invisible col-start-1 row-start-1"
                    aria-hidden
                  >
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
                className={`text-paper/70 hover:bg-paper/10 hover:text-paper w-full justify-center sm:w-auto ${touchControl}`}
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
                onClick={openBulkConfirm}
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </Button>
            </div>
          </div>
        ) : null}

        <section
          className="flex flex-col gap-4"
          aria-label="Signalements en attente"
        >
          {loading ? (
            <ListSkeleton />
          ) : (
            <PhotoClaimsTable
              claims={open}
              variant="manage"
              busyId={busyId}
              empty={
                archived.length === 0
                  ? "Aucun signalement pour l'instant."
                  : "Aucun signalement en attente."
              }
              selectMode={selectMode}
              selected={selected}
              onToggle={toggle}
              onValidate={(claim) => void setArchived(claim, true)}
              onDelete={setPendingDelete}
            />
          )}
        </section>

        {archived.length > 0 ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              aria-expanded={showArchived}
              onClick={() => setShowArchived(!showArchived)}
              className="text-paper focus-visible:ring-paper/60 inline-flex min-h-11 w-fit touch-manipulation items-center gap-1.5 rounded-md py-2 text-base font-medium focus-visible:outline-none focus-visible:ring-2 sm:min-h-0 sm:py-0 sm:text-sm"
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform duration-200",
                  showArchived && "rotate-90",
                )}
              />
              {archived.length === 1
                ? "1 signalement archivé"
                : `${archived.length} signalements archivés`}
            </button>
            {showArchived ? (
              <PhotoClaimsTable
                claims={archived}
                variant="manage"
                busyId={busyId}
                muted
                empty="Aucun signalement archivé."
                selectMode={selectMode}
                selected={selected}
                onToggle={toggle}
                onValidate={(claim) => void setArchived(claim, true)}
                onRestore={(claim) => void setArchived(claim, false)}
                onDelete={setPendingDelete}
              />
            ) : null}
          </div>
        ) : null}
      </main>
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(openDialog) => {
          if (!openDialog && !deleting) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce signalement ?</DialogTitle>
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
      <Dialog
        open={confirmOpen}
        onOpenChange={(openDialog) => {
          if (!openDialog) setConfirmOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmCount === 1
                ? "Supprimer ce signalement ?"
                : `Supprimer ces ${confirmCount} signalements ?`}
            </DialogTitle>
            <DialogDescription>
              {confirmCount === 1
                ? "Ce signalement sera supprimé définitivement."
                : "Ces signalements seront supprimés définitivement."}
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
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmBulkDelete()}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
