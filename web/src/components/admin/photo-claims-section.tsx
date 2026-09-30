import { List } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActiveClaimCount } from "@/components/admin/claim-meta";
import { PhotoClaimsTable } from "@/components/admin/photo-claims-table";
import { ListSkeleton } from "@/components/admin/shooting-list";
import { touchControlLg } from "@/components/admin/styles";
import { Button } from "@/components/ui/button";
import {
  listPhotoClaims,
  setPhotoClaimArchived,
  type PhotoClaim,
} from "@/lib/admin-client";

export function PhotoClaimsSection() {
  const [claims, setClaims] = useState<PhotoClaim[] | null>(null);
  const [openTotal, setOpenTotal] = useState(0);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const next = await listPhotoClaims({ status: "open" });
      if (cancelled) return;
      if (next === null) {
        setClaims([]);
        setOpenTotal(0);
        toast.error("Impossible de charger les signalements.");
        return;
      }
      setClaims(next.claims);
      setOpenTotal(next.total);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function validate(claim: PhotoClaim) {
    if (archivingId) return;
    setArchivingId(claim.id);
    try {
      const ok = await setPhotoClaimArchived(claim.id, true);
      if (!ok) {
        toast.error("Impossible de valider le signalement.");
        return;
      }
      setClaims(
        (current) => current?.filter((item) => item.id !== claim.id) ?? null,
      );
      setOpenTotal((current) => Math.max(0, current - 1));
      toast.success("Signalement validé.", {
        action: {
          label: "Annuler",
          onClick: () => {
            void setPhotoClaimArchived(claim.id, false).then((restored) => {
              if (!restored) {
                toast.error("Impossible de remettre le signalement en ligne.");
                return;
              }
              setOpenTotal((current) => current + 1);
              setClaims((current) => {
                if (!current) return [claim];
                if (current.some((item) => item.id === claim.id))
                  return current;
                return [claim, ...current];
              });
            });
          },
        },
      });
    } catch {
      toast.error("Impossible de valider le signalement.");
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-6" aria-label="Signalements">
      <div className="text-paper flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="type-display outline-none max-sm:text-2xl max-sm:leading-tight">
            Signalements
          </h2>
          {claims === null ? null : <ActiveClaimCount count={openTotal} />}
        </div>
        <Button
          nativeButton={false}
          size="lg"
          className={`w-full px-3 sm:w-auto ${touchControlLg}`}
          render={<a href="/admin/signalements" />}
        >
          <List />
          Voir les signalements
        </Button>
      </div>
      {claims === null ? (
        <ListSkeleton />
      ) : (
        <div className="max-h-96 overflow-y-auto overscroll-contain p-1">
          <PhotoClaimsTable
            claims={claims}
            variant="preview"
            busyId={archivingId}
            empty="Aucun signalement en attente."
            onValidate={(claim) => void validate(claim)}
          />
        </div>
      )}
    </section>
  );
}
