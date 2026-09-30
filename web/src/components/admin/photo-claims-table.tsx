import { cn } from "cn";
import { ArchiveRestore, Check, Trash2 } from "lucide-react";
import { ClaimMeta } from "@/components/admin/claim-meta";
import { claimDisplayName } from "@/components/admin/format";
import {
  panelClass,
  quietCta,
  subtleText,
  touchControl,
} from "@/components/admin/styles";
import { Button } from "@/components/ui/button";
import type { PhotoClaim } from "@/lib/admin-client";

type Props = {
  claims: PhotoClaim[];
  variant: "preview" | "manage";
  busyId: string | null;
  muted?: boolean;
  empty: string;
  selectMode?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onValidate: (claim: PhotoClaim) => void;
  onRestore?: (claim: PhotoClaim) => void;
  onDelete?: (claim: PhotoClaim) => void;
};

export function PhotoClaimsTable({
  claims,
  variant,
  busyId,
  muted = false,
  empty,
  selectMode = false,
  selected,
  onToggle,
  onValidate,
  onRestore,
  onDelete,
}: Props) {
  if (claims.length === 0) {
    return (
      <div className={cn(panelClass, muted && "bg-paper/85 shadow-none")}>
        <div className="px-5 py-5">
          <p className="font-medium">{empty}</p>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {claims.map((claim) => {
        const busy = busyId === claim.id;
        const archived = claim.status === "archived";
        const isSelected = selected?.has(claim.id) === true;
        const title = claimDisplayName(claim);
        return (
          <li
            key={claim.id}
            className={cn(panelClass, muted && "bg-paper/85 shadow-none")}
          >
            {selectMode ? (
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={
                  isSelected
                    ? `Désélectionner ${title}`
                    : `Sélectionner ${title}`
                }
                onClick={() => onToggle?.(claim.id)}
                className="flex min-h-11 w-full touch-manipulation items-start gap-4 px-5 py-3.5 text-left sm:min-h-0 sm:py-4"
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150",
                    isSelected
                      ? "bg-canvas border-canvas text-white"
                      : "bg-paper/85 border-ink/20 text-transparent",
                  )}
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <ClaimIdentity claim={claim} />
              </button>
            ) : (
              <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-4">
                <ClaimIdentity claim={claim} />
                <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                  {archived ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        quietCta,
                        touchControl,
                        "flex-1 sm:flex-none",
                      )}
                      disabled={busy}
                      onClick={() => onRestore?.(claim)}
                    >
                      <ArchiveRestore />
                      {busy ? "Désarchivage…" : "Désarchiver"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        quietCta,
                        touchControl,
                        "flex-1 sm:flex-none",
                      )}
                      disabled={busy}
                      onClick={() => onValidate(claim)}
                    >
                      <Check />
                      {busy ? "Archivage…" : "Archiver"}
                    </Button>
                  )}
                  {variant === "manage" ? (
                    <Button
                      type="button"
                      variant="destructive"
                      className={cn(touchControl, "flex-1 sm:flex-none")}
                      disabled={busy}
                      onClick={() => onDelete?.(claim)}
                    >
                      <Trash2 />
                      Supprimer
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ClaimIdentity({ claim }: { claim: PhotoClaim }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left">
      <p className="truncate font-medium leading-5">
        {claimDisplayName(claim)}
      </p>
      <ClaimMeta claim={claim} className={subtleText} />
    </div>
  );
}
