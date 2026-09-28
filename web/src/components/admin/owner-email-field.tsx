import { Combobox } from "@base-ui/react/combobox";
import { cn } from "cn";
import { ChevronDown, Plus, Search } from "lucide-react";
import { useEffect, useState, type Ref } from "react";
import { fieldClass, subtleText } from "@/components/admin/styles";
import { searchOwners, type OwnerSuggestion } from "@/lib/admin-client";

type OwnerChoice = OwnerSuggestion & { create: boolean };

type Props = {
  id: string;
  value: string;
  onValueChange: (email: string) => void;
  excludeEmails: string[];
  disabled?: boolean;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

const SEARCH_DELAY_MS = 180;

export function OwnerEmailField({
  id,
  value,
  onValueChange,
  excludeEmails,
  disabled = false,
  autoFocus = false,
  inputRef,
}: Props) {
  const [owners, setOwners] = useState<OwnerSuggestion[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const query = value.trim().toLowerCase();
  const excluded = new Set(excludeEmails.map((email) => email.toLowerCase()));
  const settled = loadedFor === query;
  const matched = owners.filter((owner) => matchesOwner(owner, query));
  const visible = matched.filter((owner) => !excluded.has(owner.email));
  const exactKnown = owners.some((owner) => owner.email === query);
  const alreadyHere =
    query !== "" &&
    visible.length === 0 &&
    matched.some((owner) => excluded.has(owner.email));
  const canCreate =
    settled && isOwnerEmail(query) && !exactKnown && !alreadyHere;
  const items: OwnerChoice[] = [
    ...visible.map((owner) => ({ ...owner, create: false })),
    ...(canCreate
      ? [{ id: `create:${query}`, email: query, dogs: [], create: true }]
      : []),
  ];

  useEffect(() => {
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      void searchOwners(query, controller.signal).then((rows) => {
        if (controller.signal.aborted) return;
        if (rows) setOwners(rows);
        setLoadedFor(query);
      });
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  return (
    <Combobox.Root<OwnerChoice>
      items={items}
      filter={null}
      inputValue={value}
      onInputValueChange={onValueChange}
      autoHighlight
      autoComplete="off"
      itemToStringLabel={(item) => item.email}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
    >
      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        />
        <Combobox.Input
          ref={inputRef}
          id={id}
          type="text"
          required
          disabled={disabled}
          autoFocus={autoFocus}
          autoCapitalize="none"
          spellCheck={false}
          placeholder="E-mail ou nom du chien"
          className={cn(fieldClass, "pl-9 pr-9")}
        />
        <Combobox.Trigger
          type="button"
          disabled={disabled}
          aria-label="Afficher les maîtres"
          className="text-ink/50 hover:bg-canvas/10 focus-visible:ring-canvas/40 group absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronDown className="group-data-popup-open:rotate-180 size-4 transition-transform duration-200" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner
          sideOffset={4}
          align="start"
          className="isolate z-50 outline-none"
        >
          <Combobox.Popup className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 w-(--anchor-width) origin-(--transform-origin) z-50 max-h-64 overflow-y-auto rounded-lg p-1 shadow-md outline-none ring-1 duration-100">
            <Combobox.Empty className={cn("px-2.5 py-2 text-sm", subtleText)}>
              {emptyCopy(query, settled, alreadyHere, owners.length > 0)}
            </Combobox.Empty>
            <Combobox.List>
              {(item: OwnerChoice) => (
                <Combobox.Item
                  key={item.id}
                  value={item}
                  className="data-highlighted:bg-canvas/10 flex cursor-default select-none flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-sm outline-none"
                >
                  <span className="truncate font-medium">{item.email}</span>
                  {item.create ? (
                    <span className="text-canvas inline-flex items-center gap-1 text-xs font-medium">
                      <Plus className="size-3" />
                      Nouveau maître
                    </span>
                  ) : (
                    <span className={cn("truncate text-xs", subtleText)}>
                      {dogLine(item.dogs)}
                    </span>
                  )}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function emptyCopy(
  query: string,
  settled: boolean,
  alreadyHere: boolean,
  hasOwners: boolean,
) {
  if (!settled) return "Recherche…";
  if (alreadyHere) return "Ce maître est déjà sur ce shooting.";
  if (!query) {
    return hasOwners
      ? "Les maîtres connus sont déjà sur ce shooting."
      : "Aucun maître pour le moment.";
  }
  if (!isOwnerEmail(query)) {
    return "Aucun maître correspondant. Saisis un e-mail complet pour en créer un.";
  }
  return "Aucun maître correspondant.";
}

function matchesOwner(owner: OwnerSuggestion, query: string) {
  if (query === "") return true;
  if (owner.email.includes(query)) return true;
  return owner.dogs.some((dog) => dog.toLowerCase().includes(query));
}

function dogLine(dogs: string[]) {
  if (dogs.length === 0) return "Aucun chien";
  if (dogs.length === 1) return dogs[0];
  return `${dogs.slice(0, -1).join(", ")} et ${dogs.at(-1)}`;
}

function isOwnerEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
