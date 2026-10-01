import { cn } from "cn";
import { Calendar, ChevronLeft, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/components/admin/format";
import { ListSkeleton } from "@/components/admin/shooting-list";
import {
  fieldClass,
  panelClass,
  quietCta,
  subtleText,
  touchControl,
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
  addShootingOwner,
  listOwnerEvents,
  type OwnerEvent,
  type OwnerEventType,
  type Shooting,
} from "@/lib/admin-client";

type Props = {
  shootings: Shooting[] | null;
  onBack: () => void;
  onAttached: () => void;
};

const eventLabels: Record<OwnerEventType, string> = {
  shooting_opened: "Galerie consultée",
  zip_downloaded: "Archive ZIP téléchargée",
  photo_downloaded: "Photo téléchargée",
  participation_claimed: "Demande de rattachement",
  instagram_message: "Message Instagram",
};

export function ActivityScreen({ shootings, onBack, onAttached }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [events, setEvents] = useState<OwnerEvent[] | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const next = await listOwnerEvents();
      if (cancelled) return;
      if (next === null) {
        setEvents([]);
        toast.error("Impossible de charger l'activité.");
        return;
      }
      setEvents(next);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
        <h1
          ref={heading}
          tabIndex={-1}
          className="type-display outline-none max-sm:text-2xl max-sm:leading-tight"
        >
          Activité
        </h1>
      </div>

      <section
        className="flex flex-col gap-4"
        aria-label="Activité des propriétaires"
      >
        {events === null ? <ListSkeleton /> : null}

        {events && events.length === 0 ? (
          <div className={panelClass}>
            <div className="px-5 pb-5 pt-5">
              <p className="font-medium">Aucune activité pour l'instant</p>
              <p className={cn("mt-1 text-sm", subtleText)}>
                Les ouvertures de galerie, les téléchargements et la redirection
                vers Instagram apparaîtront ici.
              </p>
            </div>
          </div>
        ) : null}

        {events && events.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {events.map((event) => (
              <ActivityRow
                key={event.id}
                event={event}
                onAttach={
                  isContactRequest(event.type) && !event.shootingId
                    ? () => setPendingEmail(event.email)
                    : undefined
                }
              />
            ))}
          </ul>
        ) : null}
      </section>

      <AttachOwnerDialog
        email={pendingEmail}
        shootings={shootings}
        onClose={() => setPendingEmail(null)}
        onAttached={onAttached}
      />
    </>
  );
}

function ActivityRow({
  event,
  onAttach,
}: {
  event: OwnerEvent;
  onAttach?: () => void;
}) {
  const shooting = eventShooting(event);

  return (
    <li className={panelClass}>
      <div className="grid gap-x-4 gap-y-2 px-5 py-3.5 text-sm leading-5 sm:grid-cols-[minmax(8rem,9rem)_minmax(12rem,1fr)_auto_9.5rem] sm:items-center sm:py-4">
        <p className="truncate font-medium">{event.email}</p>
        <p className="min-w-0">
          <span className="text-ink font-medium">
            {eventLabels[event.type]}
          </span>
          {shooting ? (
            <>
              <span className="text-ink/60 hidden sm:inline"> sur </span>
              <span className="text-ink/60 mt-0.5 block truncate sm:mt-0 sm:inline">
                <span className="sm:hidden">Shooting : </span>
                {shooting}
              </span>
            </>
          ) : null}
        </p>
        <p
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap",
            subtleText,
          )}
        >
          <Calendar className="size-3.5 shrink-0" aria-hidden />
          <time dateTime={event.createdAt}>
            {formatDateTime(event.createdAt)}
          </time>
        </p>
        {onAttach ? (
          <Button
            type="button"
            variant="outline"
            className={cn(quietCta, touchControl, "w-full")}
            onClick={onAttach}
          >
            <Plus />
            Lier à un shooting
          </Button>
        ) : (
          <span className="hidden sm:block" aria-hidden />
        )}
      </div>
    </li>
  );
}

function isContactRequest(type: OwnerEventType) {
  return type === "participation_claimed" || type === "instagram_message";
}

function eventShooting(event: OwnerEvent) {
  if (isContactRequest(event.type)) return null;
  return event.shootingName ?? "Shooting supprimé";
}

function AttachOwnerDialog({
  email,
  shootings,
  onClose,
  onAttached,
}: {
  email: string | null;
  shootings: Shooting[] | null;
  onClose: () => void;
  onAttached: () => void;
}) {
  const [shootingId, setShootingId] = useState("");
  const [saving, setSaving] = useState(false);
  const active = shootings?.filter((shooting) => !shooting.archived) ?? [];

  useEffect(() => {
    if (!email) {
      setShootingId("");
      setSaving(false);
    }
  }, [email]);

  async function attach() {
    if (!email || !shootingId || saving) return;
    setSaving(true);
    try {
      const result = await addShootingOwner(shootingId, { email });
      if (result === "duplicate") {
        toast.error("Ce participant est déjà sur ce shooting.");
        return;
      }
      if (result === "error") {
        toast.error("Impossible d'ajouter le participant.");
        return;
      }
      toast.success("Participant ajouté.");
      onAttached();
      onClose();
    } catch {
      toast.error("Impossible d'ajouter le participant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={email !== null}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lier à un shooting</DialogTitle>
          <DialogDescription>
            {email
              ? `Ajoute ${email} comme participant du shooting choisi.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {active.length === 0 ? (
          <p className={cn("text-sm", subtleText)}>
            Aucun shooting en cours. Crée-en un d’abord.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="attach-shooting"
              className="text-base font-medium sm:text-sm"
            >
              Shooting
            </label>
            <select
              id="attach-shooting"
              required
              value={shootingId}
              onChange={(event) => setShootingId(event.target.value)}
              className={fieldClass}
            >
              <option value="">Choisir un shooting</option>
              {active.map((shooting) => (
                <option key={shooting.id} value={shooting.id}>
                  {shooting.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={quietCta}
            disabled={saving}
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={saving || !shootingId}
            onClick={() => void attach()}
          >
            {saving ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
