import { cn } from "cn";
import { endOfDay, format, isWithinInterval, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, Check, ChevronDown, Search, X } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { panelClass } from "@/components/admin/styles";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { OwnerEvent, OwnerEventType } from "@/lib/admin-client";

export const eventLabels: Record<OwnerEventType, string> = {
  shooting_opened: "Galerie consultée",
  zip_downloaded: "Archive ZIP téléchargée",
  photo_downloaded: "Photo téléchargée",
  participation_claimed: "Demande de rattachement",
  instagram_message: "Message Instagram",
};

const eventTypes = Object.keys(eventLabels) as OwnerEventType[];

export type ActivityFilters = {
  email: string;
  visitorId: string | null;
  types: OwnerEventType[];
  range: DateRange | undefined;
};

export const emptyActivityFilters: ActivityFilters = {
  email: "",
  visitorId: null,
  types: [],
  range: undefined,
};

const barControl =
  "text-ink flex h-12 min-h-12 w-full items-center border-0 bg-transparent px-4 text-base outline-none sm:h-11 sm:min-h-11 sm:text-sm";

const triggerClass = cn(
  barControl,
  "justify-between gap-2 text-left font-normal",
);

const menuItemClass =
  "hover:bg-canvas/10 focus-visible:bg-canvas/10 flex min-h-11 w-full touch-manipulation items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-base outline-none sm:min-h-8 sm:px-2 sm:py-1.5 sm:text-sm";

export function hasActivityFilters(filters: ActivityFilters) {
  return (
    filters.email.trim() !== "" ||
    filters.visitorId != null ||
    filters.types.length > 0 ||
    filters.range?.from != null
  );
}

export function filterOwnerEvents(
  events: OwnerEvent[],
  filters: ActivityFilters,
) {
  const email = filters.email.trim().toLowerCase();
  const types = new Set(filters.types);
  const from = filters.range?.from;
  const interval = from
    ? {
        start: startOfDay(from),
        end: endOfDay(filters.range?.to ?? from),
      }
    : null;

  return events.filter((event) => {
    if (filters.visitorId && event.visitorId !== filters.visitorId)
      return false;
    if (email && !event.email.toLowerCase().includes(email)) return false;
    if (types.size > 0 && !types.has(event.type)) return false;
    if (interval && !isWithinInterval(new Date(event.createdAt), interval)) {
      return false;
    }
    return true;
  });
}

type Props = {
  filters: ActivityFilters;
  visitorLabel?: string;
  onChange: (filters: ActivityFilters) => void;
};

export function ActivityFiltersBar({ filters, visitorLabel, onChange }: Props) {
  const [panel, setPanel] = useState<"types" | "dates" | null>(null);
  const active = hasActivityFilters(filters);

  function toggleType(type: OwnerEventType) {
    const types = filters.types.includes(type)
      ? filters.types.filter((item) => item !== type)
      : [...filters.types, type];
    onChange({ ...filters, types });
  }

  function reset() {
    setPanel(null);
    onChange(emptyActivityFilters);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          panelClass,
          "focus-within:ring-canvas/15 focus-within:ring-3 flex flex-col lg:flex-row",
        )}
      >
        <div className="border-ink/10 relative min-w-0 flex-1 border-b lg:border-b-0 lg:border-r">
          <Search
            aria-hidden
            className="text-ink/45 pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2"
          />
          <label htmlFor="activity-email" className="sr-only">
            E-mail
          </label>
          <input
            id="activity-email"
            type="text"
            inputMode="email"
            value={filters.email}
            onChange={(event) =>
              onChange({ ...filters, email: event.target.value })
            }
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="E-mail"
            className={cn(
              barControl,
              "placeholder:text-ink/45 pl-11 pr-4",
              filters.email && "pr-12 sm:pr-10",
            )}
          />
          {filters.email ? (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => onChange({ ...filters, email: "" })}
              className="text-ink/50 hover:bg-canvas/10 hover:text-ink focus-visible:ring-canvas/40 absolute right-1 top-1/2 grid size-11 -translate-y-1/2 touch-manipulation place-items-center rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 sm:size-8"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="border-ink/10 min-w-0 border-b lg:w-52 lg:shrink-0 lg:border-b-0 lg:border-r">
          <Popover
            open={panel === "types"}
            onOpenChange={(open) => setPanel(open ? "types" : null)}
          >
            <PopoverTrigger
              id="activity-types"
              aria-label="Type d'événement"
              className={triggerClass}
            >
              <span
                className={cn(
                  "truncate",
                  filters.types.length === 0 && "text-ink/45",
                )}
              >
                {typeSummary(filters.types)}
              </span>
              <ChevronDown
                className="text-ink/45 size-4 shrink-0"
                aria-hidden
              />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="bg-paper text-ink shadow-paper ring-ink/10 w-(--anchor-width) min-w-64 p-1"
            >
              <div role="group" aria-label="Types d'événement">
                {eventTypes.map((type) => {
                  const checked = filters.types.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      className={menuItemClass}
                      onClick={() => toggleType(type)}
                    >
                      {eventLabels[type]}
                      <Check
                        className={cn(
                          "size-4 shrink-0",
                          !checked && "invisible",
                        )}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="min-w-0 lg:w-56 lg:shrink-0">
          <Popover
            open={panel === "dates"}
            onOpenChange={(open) => setPanel(open ? "dates" : null)}
          >
            <PopoverTrigger
              id="activity-dates"
              aria-label="Dates"
              className={triggerClass}
            >
              <span
                className={cn(
                  "truncate",
                  !filters.range?.from && "text-ink/45",
                )}
              >
                {dateSummary(filters.range)}
              </span>
              <CalendarDays
                className="text-ink/45 size-4 shrink-0"
                aria-hidden
              />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="bg-paper text-ink shadow-paper w-auto p-2"
            >
              <Calendar
                mode="range"
                locale={fr}
                selected={filters.range}
                onSelect={(range) => onChange({ ...filters, range })}
                defaultMonth={filters.range?.from}
                labels={{
                  labelPrevious: () => "Mois précédent",
                  labelNext: () => "Mois suivant",
                }}
              />
              {filters.range?.from ? (
                <div className="px-2 pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-ink hover:bg-canvas/10 w-full"
                    onClick={() => onChange({ ...filters, range: undefined })}
                  >
                    Effacer les dates
                  </Button>
                </div>
              ) : null}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex min-h-6 flex-wrap items-center gap-x-4 gap-y-2">
        {filters.visitorId ? (
          <button
            type="button"
            className="bg-paper/15 text-paper hover:bg-paper/25 inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-sm"
            onClick={() => onChange({ ...filters, visitorId: null })}
          >
            <span className="min-w-0 truncate">
              Visiteur : {visitorLabel ?? "sélectionné"}
            </span>
            <X className="size-3.5 shrink-0" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          className={cn(
            "admin-link text-base sm:text-sm",
            !active && "invisible",
          )}
          tabIndex={active ? undefined : -1}
          onClick={reset}
        >
          Effacer les filtres
        </button>
      </div>
    </div>
  );
}

function typeSummary(types: OwnerEventType[]) {
  if (types.length === 0) return "Tous les types";
  if (types.length === 1) return eventLabels[types[0]];
  return `${types.length} types`;
}

function dateSummary(range: DateRange | undefined) {
  if (!range?.from) return "Toutes les dates";
  const from = formatDay(range.from);
  if (
    !range.to ||
    startOfDay(range.to).getTime() === startOfDay(range.from).getTime()
  ) {
    return from;
  }
  return `${from} – ${formatDay(range.to)}`;
}

function formatDay(date: Date) {
  return format(date, "d MMM yyyy", { locale: fr });
}
