import { cn } from "cn";
import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { today } from "@/components/admin/format";
import { ShootingMeta } from "@/components/admin/shooting-meta";
import {
  fieldClass,
  panelClass,
  rowHover,
  subtleText,
  touchControlLg,
} from "@/components/admin/styles";
import { Button } from "@/components/ui/button";
import { createShooting, type Shooting } from "@/lib/admin-client";

type Props = {
  shootings: Shooting[] | null;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
  onOpen: (id: string) => void;
  onCreated: (id: string) => void;
};

export function ShootingList({
  shootings,
  showArchived,
  onShowArchivedChange,
  onOpen,
  onCreated,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const loading = shootings === null;
  const active = shootings?.filter((shooting) => !shooting.archived) ?? [];
  const archived = shootings?.filter((shooting) => shooting.archived) ?? [];
  const empty = !loading && active.length === 0;
  const showForm = formOpen || empty;

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <>
      <div className="text-paper flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1
          ref={heading}
          tabIndex={-1}
          className="type-display outline-none max-sm:text-2xl max-sm:leading-tight"
        >
          Shootings
        </h1>
        {loading || showForm ? null : (
          <Button
            type="button"
            size="lg"
            className={`w-full px-3 sm:w-auto ${touchControlLg}`}
            onClick={() => setFormOpen(true)}
          >
            <Plus />
            Ajouter un shooting
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-4" aria-label="Shootings en cours">
        {loading ? <ListSkeleton /> : null}

        {showForm ? (
          <div className={panelClass}>
            {empty ? (
              <div className="px-5 pt-5">
                <p className="font-medium">
                  {archived.length === 0
                    ? "Aucun shooting pour l'instant"
                    : "Aucun shooting en cours"}
                </p>
                <p className={cn("mt-1 text-sm", subtleText)}>
                  Crée un shooting, puis ajoute les participants et leurs
                  photos.
                </p>
              </div>
            ) : null}
            <form
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end"
              onSubmit={async (event) => {
                event.preventDefault();
                if (creating) return;
                const data = new FormData(event.currentTarget);
                setCreating(true);
                try {
                  const id = await createShooting({
                    shotOn: String(data.get("shotOn") ?? ""),
                    name: String(data.get("name") ?? ""),
                  });
                  if (!id) {
                    toast.error("Impossible de créer le shooting.");
                    return;
                  }
                  toast.success("Shooting créé.");
                  setFormOpen(false);
                  onCreated(id);
                } catch {
                  toast.error("Impossible de créer le shooting.");
                } finally {
                  setCreating(false);
                }
              }}
            >
              <div className="flex flex-[1.4] flex-col gap-1.5">
                <label
                  htmlFor="shooting-name"
                  className="text-base font-medium sm:text-sm"
                >
                  Nom
                </label>
                <input
                  id="shooting-name"
                  name="name"
                  type="text"
                  required
                  maxLength={80}
                  autoFocus={!empty}
                  placeholder="Séance du dimanche"
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label
                  htmlFor="shot-on"
                  className="text-base font-medium sm:text-sm"
                >
                  Date
                </label>
                <input
                  id="shot-on"
                  name="shotOn"
                  type="date"
                  required
                  defaultValue={today()}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  size="lg"
                  disabled={creating}
                  className={`w-full sm:w-auto ${touchControlLg}`}
                >
                  {creating ? "Ajout…" : "Ajouter"}
                </Button>
                {empty ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className={`w-full sm:w-auto ${touchControlLg}`}
                    onClick={() => setFormOpen(false)}
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </form>
          </div>
        ) : null}

        {active.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {active.map((shooting) => (
              <ShootingLink
                key={shooting.id}
                shooting={shooting}
                onOpen={onOpen}
              />
            ))}
          </ul>
        ) : null}
      </section>

      {archived.length > 0 ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => onShowArchivedChange(!showArchived)}
            className="text-paper focus-visible:ring-paper/60 inline-flex min-h-11 w-fit touch-manipulation items-center gap-1.5 rounded-md py-2 text-base font-medium focus-visible:outline-none focus-visible:ring-2 sm:min-h-0 sm:py-0 sm:text-sm"
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform duration-200",
                showArchived && "rotate-90",
              )}
            />
            {archived.length === 1
              ? "1 shooting archivé"
              : `${archived.length} shootings archivés`}
          </button>
          {showArchived ? (
            <ul className="flex flex-col gap-4" aria-label="Shootings archivés">
              {archived.map((shooting) => (
                <ShootingLink
                  key={shooting.id}
                  shooting={shooting}
                  onOpen={onOpen}
                  muted
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ShootingLink({
  shooting,
  onOpen,
  muted = false,
}: {
  shooting: Shooting;
  onOpen: (id: string) => void;
  muted?: boolean;
}) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    onOpen(shooting.id);
  }

  return (
    <li className={cn(panelClass, muted && "bg-paper/85 shadow-none")}>
      <a
        href={`?shooting=${shooting.id}`}
        onClick={onClick}
        className={cn(
          "group flex min-h-11 touch-manipulation items-center gap-4 px-5 py-3.5 sm:min-h-0 sm:py-4",
          rowHover,
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="truncate font-medium leading-5">{shooting.name}</p>
          <ShootingMeta shooting={shooting} className={subtleText} />
        </div>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5",
            subtleText,
          )}
        />
      </a>
    </li>
  );
}

export function ListSkeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Chargement…
      </p>
      <ul aria-hidden="true" className="flex flex-col gap-4">
        {[0, 1, 2].map((row) => (
          <li key={row} className={cn(panelClass, "px-5 py-4")}>
            <div className="bg-ink/10 h-4 w-40 animate-pulse rounded motion-reduce:animate-none" />
            <div className="mt-2 flex gap-3">
              <div className="bg-ink/7 h-3.5 w-28 animate-pulse rounded motion-reduce:animate-none" />
              <div className="bg-ink/7 h-3.5 w-24 animate-pulse rounded motion-reduce:animate-none" />
              <div className="bg-ink/7 h-3.5 w-20 animate-pulse rounded motion-reduce:animate-none" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
