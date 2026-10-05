import { Avatar, Style } from "@dicebear/core";
import critters from "@dicebear/styles/critters.json" with { type: "json" };
import { cn } from "cn";
import { Calendar, ChevronLeft, Mail, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ActivityFiltersBar,
  emptyActivityFilters,
  eventLabels,
  filterOwnerEvents,
  hasActivityFilters,
  type ActivityFilters,
} from "@/components/admin/activity-filters";
import { formatActivityDate } from "@/components/admin/format";
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
  deleteOwnerEvent,
  listOwnerEvents,
  type OwnerEvent,
  type OwnerEventType,
  type Shooting,
} from "@/lib/admin-client";

const crittersStyle = new Style(critters);

type Props = {
  shootings: Shooting[] | null;
  onBack: () => void;
  onAttached: () => void;
};

export function ActivityScreen({ shootings, onBack, onAttached }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [events, setEvents] = useState<OwnerEvent[] | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OwnerEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState<ActivityFilters>(emptyActivityFilters);

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

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const ok = await deleteOwnerEvent(pendingDelete.id);
      if (!ok) {
        toast.error("Impossible de supprimer l'activité.");
        return;
      }
      setEvents(
        (current) =>
          current?.filter((event) => event.id !== pendingDelete.id) ?? current,
      );
      toast.success("Activité supprimée.");
      setPendingDelete(null);
    } catch {
      toast.error("Impossible de supprimer l'activité.");
    } finally {
      setDeleting(false);
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
          <ActivityList
            events={events}
            filters={filters}
            onFiltersChange={setFilters}
            onAttach={setPendingEmail}
            onDelete={setPendingDelete}
          />
        ) : null}
      </section>

      <AttachOwnerDialog
        email={pendingEmail}
        shootings={shootings}
        onClose={() => setPendingEmail(null)}
        onAttached={onAttached}
      />
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette activité ?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `${eventLabels[pendingDelete.type]} de ${pendingDelete.email}. Cette ligne disparaît de l'historique.`
                : ""}
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

function ActivityList({
  events,
  filters,
  onFiltersChange,
  onAttach,
  onDelete,
}: {
  events: OwnerEvent[];
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  onAttach: (email: string) => void;
  onDelete: (event: OwnerEvent) => void;
}) {
  const visible = filterOwnerEvents(events, filters);
  const groups = groupOwnerEvents(visible);
  const filtering = hasActivityFilters(filters);
  const visitorLabel = filters.visitorId
    ? visitorEmails(events, filters.visitorId)
    : undefined;

  return (
    <>
      <ActivityFiltersBar
        filters={filters}
        visitorLabel={visitorLabel}
        onChange={onFiltersChange}
      />
      {visible.length === 0 ? (
        <div className={panelClass}>
          <div className="px-5 pb-5 pt-5">
            <p className="font-medium">Aucun résultat</p>
            <p className={cn("mt-1 text-sm", subtleText)}>
              Aucune activité ne correspond à ces filtres.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => (
            <ActivityGroup
              key={group.key}
              group={group}
              selected={filters.visitorId === group.key}
              onSelectVisitor={() =>
                onFiltersChange({
                  ...filters,
                  visitorId: filters.visitorId === group.key ? null : group.key,
                })
              }
              onAttach={onAttach}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
      {filtering ? (
        <p className="type-caption text-paper/80">
          {visible.length === 1 ? "1 activité" : `${visible.length} activités`}
        </p>
      ) : null}
    </>
  );
}

type ActivityGroupData = {
  key: string;
  emails: string[];
  events: OwnerEvent[];
};

function groupOwnerEvents(events: OwnerEvent[]): ActivityGroupData[] {
  const groups = new Map<string, ActivityGroupData>();
  for (const event of events) {
    const key = event.visitorId ?? `legacy:${event.id}`;
    const group = groups.get(key) ?? { key, emails: [], events: [] };
    group.events.push(event);
    if (!group.emails.includes(event.email)) group.emails.push(event.email);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function visitorEmails(events: OwnerEvent[], visitorId: string) {
  const emails: string[] = [];
  for (const event of events) {
    if (event.visitorId !== visitorId) continue;
    if (!emails.includes(event.email)) emails.push(event.email);
  }
  return emails.join(", ");
}

function isTrackedVisitor(key: string) {
  return !key.startsWith("legacy:");
}

function ActivityGroup({
  group,
  selected,
  onSelectVisitor,
  onAttach,
  onDelete,
}: {
  group: ActivityGroupData;
  selected: boolean;
  onSelectVisitor: () => void;
  onAttach: (email: string) => void;
  onDelete: (event: OwnerEvent) => void;
}) {
  const label = group.emails.join(", ");
  const canFilter = isTrackedVisitor(group.key);

  return (
    <li className={panelClass}>
      <div className="border-ink/10 flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        {canFilter ? (
          <button
            type="button"
            className="hover:bg-canvas/8 focus-visible:ring-canvas/40 flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2"
            aria-pressed={selected}
            aria-label={
              selected
                ? "Retirer le filtre visiteur"
                : `Voir uniquement ${label}`
            }
            onClick={onSelectVisitor}
          >
            <VisitorAvatar name={group.key} />
            <p className="min-w-0 break-all text-sm font-medium leading-snug">
              {label}
            </p>
          </button>
        ) : (
          <>
            <VisitorAvatar name={group.key} />
            <p className="min-w-0 break-all text-sm font-medium leading-snug">
              {label}
            </p>
          </>
        )}
      </div>
      <ul className="divide-ink/10 divide-y">
        {group.events.map((event) => (
          <ActivityRow
            key={event.id}
            event={event}
            showEmail={group.emails.length > 1}
            onAttach={
              isContactRequest(event.type) && !event.shootingId
                ? () => onAttach(event.email)
                : undefined
            }
            onDelete={() => onDelete(event)}
          />
        ))}
      </ul>
    </li>
  );
}

function VisitorAvatar({ name }: { name: string }) {
  const src = new Avatar(crittersStyle, {
    seed: name,
    size: 64,
  }).toDataUri();

  return (
    <img
      src={src}
      alt=""
      width={24}
      height={24}
      aria-hidden
      className="block size-6 shrink-0"
    />
  );
}

function ActivityRow({
  event,
  showEmail,
  onAttach,
  onDelete,
}: {
  event: OwnerEvent;
  showEmail: boolean;
  onAttach?: () => void;
  onDelete: () => void;
}) {
  const shooting = eventShooting(event);

  const meta = (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm",
        subtleText,
      )}
    >
      <p className="inline-flex shrink-0 items-center gap-1.5">
        <Calendar className="size-3.5 shrink-0" aria-hidden />
        <time dateTime={event.createdAt}>
          {formatActivityDate(event.createdAt)}
        </time>
      </p>
      {showEmail ? (
        <p className="inline-flex min-w-0 items-center gap-1.5">
          <Mail className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{event.email}</span>
        </p>
      ) : null}
    </div>
  );

  return (
    <li>
      <div className="flex flex-col gap-2 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="min-w-0 text-base leading-snug sm:truncate">
              <span className="font-medium">{eventLabels[event.type]}</span>
              {shooting ? (
                <span className="text-ink/60"> sur {shooting}</span>
              ) : null}
            </p>
            <div className="sm:hidden">{meta}</div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {onAttach ? (
              <Button
                type="button"
                variant="outline"
                className={cn(
                  quietCta,
                  touchControl,
                  "w-full shrink-0 sm:w-auto",
                )}
                onClick={onAttach}
              >
                <Plus />
                Lier à un shooting
              </Button>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className={cn(
                touchControl,
                "w-full shrink-0 justify-center sm:w-auto",
              )}
              onClick={onDelete}
            >
              Supprimer
            </Button>
          </div>
        </div>
        <div className="hidden sm:block">{meta}</div>
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
