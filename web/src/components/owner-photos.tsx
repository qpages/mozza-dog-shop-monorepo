import { cn } from "cn";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Images,
  PawPrint,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDate, photoLabel } from "@/components/admin/format";
import { OwnerGallery } from "@/components/owner-gallery";
import { PhotoPrints } from "@/components/photo-prints";
import {
  fieldClass,
  panelClass,
  rowHover,
  subtleText,
} from "@/components/admin/styles";
import { SiteMenu } from "@/components/site-menu";
import { PhotoParticipationDialog } from "@/components/photo-participation-dialog";
import { Button } from "@/components/ui/button";
import {
  archiveFilenameFromShootingName,
  canAttemptArchiveShare,
  fetchOwnerGallery,
  recordOwnerEvent,
  shareArchiveIfPossible,
  shootingArchiveUrl,
  triggerArchiveDownload,
  type OwnerShooting,
} from "@/lib/photos-client";

function readParams() {
  if (typeof window === "undefined") return { email: "", shootingId: null };
  const params = new URLSearchParams(window.location.search);
  return {
    email: params.get("email")?.trim() ?? "",
    shootingId: params.get("shooting"),
  };
}

function writeParams(
  email: string,
  shootingId: string | null,
  replace = false,
) {
  const url = new URL(window.location.href);
  if (email) url.searchParams.set("email", email);
  else url.searchParams.delete("email");
  if (shootingId) url.searchParams.set("shooting", shootingId);
  else url.searchParams.delete("shooting");
  if (replace) window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
}

export function OwnerPhotos() {
  const initial = readParams();
  const [reload, setReload] = useState(0);
  const [email, setEmail] = useState(initial.email);
  const [shootingId, setShootingId] = useState<string | null>(
    initial.shootingId,
  );
  const [shootings, setShootings] = useState<OwnerShooting[] | null>(
    email ? null : [],
  );
  const [status, setStatus] = useState<"idle" | "loading" | "error">(
    email ? "loading" : "idle",
  );

  const opened =
    shootings && shootings.length === 1 && !shootingId
      ? shootings[0]
      : shootingId
        ? shootings?.find((shooting) => shooting.id === shootingId)
        : undefined;

  useEffect(() => {
    const next = readParams();
    setEmail(next.email);
    setShootingId(next.shootingId);

    const onPopState = () => {
      const fromUrl = readParams();
      setEmail(fromUrl.email);
      setShootingId(fromUrl.shootingId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!email) {
      setShootings([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setShootings(null);

    async function load() {
      const next = await fetchOwnerGallery(email);
      if (controller.signal.aborted) return;
      if (next === null) {
        setStatus("error");
        setShootings([]);
        return;
      }
      setShootings(next);
      setStatus("idle");
    }

    void load();
    return () => controller.abort();
  }, [email, reload]);

  useEffect(() => {
    if (!email || !shootings) return;
    if (shootingId && !opened) {
      navigate(email, null, true);
      return;
    }
    if (!shootingId && shootings.length === 1) {
      navigate(email, shootings[0].id, true);
    }
  }, [email, opened, shootingId, shootings]);

  function navigate(
    nextEmail: string,
    nextShootingId: string | null,
    replace = false,
  ) {
    writeParams(nextEmail, nextShootingId, replace);
    if (nextEmail !== email) {
      if (nextEmail) {
        setShootings(null);
        setStatus("loading");
      } else {
        setShootings([]);
        setStatus("idle");
      }
    }
    setEmail(nextEmail);
    setShootingId(nextShootingId);
    window.scrollTo({ top: 0 });
  }

  function submitEmail(value: string) {
    navigate(value, null);
  }

  function clearEmail() {
    navigate("", null);
  }

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-5 py-4 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] sm:gap-4 sm:px-8 sm:py-5 sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))] sm:pt-[max(1.25rem,env(safe-area-inset-top))]">
        <a href="/" className="admin-logo shrink-0" aria-label="Mozza Dog Shop">
          <img
            src="/logo.png"
            alt=""
            width="600"
            height="338"
            className="h-16 w-auto sm:h-20"
          />
        </a>
        <div className="flex min-w-0 items-center gap-0.5 sm:gap-2">
          <div className="mr-1 hidden min-w-0 sm:block">
            {email ? (
              <p className="type-caption text-paper/95 max-w-40 truncate sm:max-w-56 md:max-w-none">
                {email}
              </p>
            ) : (
              <a href="/admin" className="admin-link">
                Espace admin
              </a>
            )}
          </div>
          <a
            href="https://www.instagram.com/mozza.dog.shop/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de Mozza Dog Shop"
            className="text-paper hover:bg-paper/10 focus-visible:ring-paper/50 inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 sm:size-10"
          >
            <InstagramIcon className="size-6 sm:size-5" />
          </a>
          <SiteMenu email={email || null} />
        </div>
      </header>

      {email ? (
        <GalleryScreen
          email={email}
          status={status}
          shootings={shootings}
          opened={opened}
          shootingId={shootingId}
          onOpen={(id) => navigate(email, id)}
          onBack={() => navigate(email, null)}
          onHome={clearEmail}
          onRetry={() => setReload((value) => value + 1)}
        />
      ) : (
        <EmailGate onSubmit={submitEmail} />
      )}

      {email ? (
        <a
          href="https://mozzadogshop.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-paper text-ink shadow-paper hover:bg-paper/95 focus-visible:ring-primary/50 fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-[max(1.25rem,env(safe-area-inset-left))] z-30 hidden min-h-11 touch-manipulation items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 sm:inline-flex"
          aria-label="Ouvrir le site Mozza Dog Shop dans un nouvel onglet"
        >
          <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
          Accéder à la boutique
        </a>
      ) : null}
    </div>
  );
}

function EmailGate({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [participationOpen, setParticipationOpen] = useState(false);

  return (
    <div className="admin-rise flex flex-1 flex-col items-center justify-start gap-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2 sm:justify-center sm:gap-10 sm:py-8 sm:pb-8">
      <main className="mx-auto flex w-full max-w-md shrink-0 flex-col gap-5 px-6">
        <div className="text-paper flex flex-col gap-2 text-center">
          <h1 className="type-display text-balance max-sm:text-2xl max-sm:leading-tight">
            Vos photos
          </h1>
          <p className="type-body text-paper/95">
            Récupérez les clichés numériques d'un shooting chez Mozza Dog Shop.
          </p>
        </div>
        <div className="bg-paper shadow-paper rounded-2xl p-5">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const value = String(data.get("email") ?? "").trim();
              if (!value) return;
              onSubmit(value);
            }}
          >
            <label htmlFor="email" className="text-base font-medium sm:text-sm">
              E-mail renseigné lors du shooting
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="vous@email.com"
              className={cn(fieldClass, "min-h-11 touch-manipulation")}
            />
            <Button
              type="submit"
              size="lg"
              className="mt-2 min-h-11 w-full touch-manipulation text-base sm:min-h-9 sm:text-sm"
            >
              Voir mes photos
            </Button>
          </form>
        </div>
        <a
          href="https://mozzadogshop.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-paper text-ink shadow-paper hover:bg-paper/95 focus-visible:ring-primary/50 inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-lg px-3.5 text-base font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 sm:text-sm"
          aria-label="Ouvrir le site Mozza Dog Shop dans un nouvel onglet"
        >
          <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
          Accéder à la boutique
        </a>
        <button
          type="button"
          className="text-paper/85 hover:text-paper focus-visible:text-paper focus-visible:ring-paper/40 mx-auto -mt-2 min-h-11 w-fit touch-manipulation px-2 text-xs underline-offset-2 transition-colors duration-200 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2"
          onClick={() => setParticipationOpen(true)}
        >
          J’ai oublié l’e-mail renseigné
        </button>
      </main>
      <PhotoPrints />
      <PhotoParticipationDialog
        email=""
        open={participationOpen}
        onOpenChange={setParticipationOpen}
      />
    </div>
  );
}

function GalleryScreen({
  email,
  status,
  shootings,
  opened,
  shootingId,
  onOpen,
  onBack,
  onHome,
  onRetry,
}: {
  email: string;
  status: "idle" | "loading" | "error";
  shootings: OwnerShooting[] | null;
  opened: OwnerShooting | undefined;
  shootingId: string | null;
  onOpen: (id: string) => void;
  onBack: () => void;
  onHome: () => void;
  onRetry: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const showList = !shootingId;
  const many = (shootings?.length ?? 0) > 1;

  useEffect(() => {
    heading.current?.focus();
  }, [opened?.id, showList]);

  useEffect(() => {
    if (!opened) return;
    void recordOwnerEvent({
      type: "shooting_opened",
      email,
      shootingId: opened.id,
    });
  }, [email, opened?.id]);

  return (
    <main
      className={cn(
        "admin-rise mx-auto flex w-full flex-1 flex-col gap-6 px-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4",
        opened ? "max-w-5xl" : "max-w-3xl",
      )}
    >
      {status === "error" ? (
        <>
          <div className="flex flex-col gap-3">
            <BackLink href="/" onClick={onHome}>
              Accueil
            </BackLink>
            <h1
              ref={heading}
              tabIndex={-1}
              className="type-display text-paper text-balance outline-none max-sm:text-2xl max-sm:leading-tight"
            >
              Vos shootings
            </h1>
          </div>
          <section className={panelClass}>
            <div className="flex flex-col gap-3 px-5 py-6">
              <p className="text-base font-medium">
                Le service photo est indisponible.
              </p>
              <p className={cn("text-sm", subtleText)}>
                Réessayez dans un instant.
              </p>
              <Button
                type="button"
                className="min-h-11 w-fit touch-manipulation px-3.5 text-base sm:min-h-8 sm:text-sm"
                onClick={onRetry}
              >
                Réessayer
              </Button>
            </div>
          </section>
        </>
      ) : null}

      {status !== "error" && opened ? (
        <>
          <div className="flex flex-col gap-3">
            {many ? (
              <BackLink
                href={`?email=${encodeURIComponent(email)}`}
                onClick={onBack}
              >
                Shootings
              </BackLink>
            ) : (
              <BackLink href="/" onClick={onHome}>
                Accueil
              </BackLink>
            )}
            <div className="text-paper flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-col gap-1.5">
                <h1
                  ref={heading}
                  tabIndex={-1}
                  className="type-display text-balance outline-none max-sm:text-2xl max-sm:leading-tight"
                >
                  {opened.name}
                </h1>
                <ShootingFacts shooting={opened} className="text-paper/85" />
              </div>
              {opened.photos.length === 0 ? null : (
                <ArchiveDownloadLink
                  href={shootingArchiveUrl(email, opened.id)}
                  shootingName={opened.name}
                />
              )}
            </div>
          </div>
          <section className={cn(panelClass, "p-5")}>
            <OwnerGallery email={email} shooting={opened} />
          </section>
        </>
      ) : null}

      {status !== "error" && shootingId && !opened ? <ListSkeleton /> : null}

      {status !== "error" && showList ? (
        <>
          <div className="flex flex-col gap-3">
            <BackLink href="/" onClick={onHome}>
              Accueil
            </BackLink>
            <h1
              ref={heading}
              tabIndex={-1}
              className="type-display text-paper text-balance outline-none max-sm:text-2xl max-sm:leading-tight"
            >
              Vos shootings
            </h1>
          </div>
          <section className="flex flex-col gap-4" aria-label="Vos shootings">
            {status === "loading" || shootings === null ? (
              <ListSkeleton />
            ) : null}

            {status === "idle" && shootings && shootings.length === 0 ? (
              <EmptyEmailState email={email} />
            ) : null}

            {status === "idle" && shootings && shootings.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {shootings.map((shooting) => (
                  <li key={shooting.id} className={panelClass}>
                    <a
                      href={`?email=${encodeURIComponent(email)}&shooting=${shooting.id}`}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey)
                          return;
                        event.preventDefault();
                        onOpen(shooting.id);
                      }}
                      className={cn(
                        "group flex min-h-11 touch-manipulation items-center gap-4 px-5 py-3.5 sm:min-h-0 sm:py-4",
                        rowHover,
                      )}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <p className="truncate text-base font-medium leading-snug sm:text-sm sm:leading-5">
                          {shooting.name}
                        </p>
                        <ShootingFacts
                          shooting={shooting}
                          className={subtleText}
                        />
                      </div>
                      <ChevronRight
                        className={cn(
                          "size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5",
                          subtleText,
                        )}
                      />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}

function EmptyEmailState({ email }: { email: string }) {
  const [claimOpen, setClaimOpen] = useState(false);

  return (
    <>
      <div className={cn(panelClass, "px-5 py-6")}>
        <p className="text-base font-medium">Aucune photo pour cet e-mail</p>
        <p className={cn("mt-1 text-sm leading-normal", subtleText)}>
          Aucun shooting n’est lié à{" "}
          <span className="text-foreground font-medium">{email}</span> pour
          l’instant.
        </p>
        <Button
          type="button"
          className="mt-4 min-h-11 w-full touch-manipulation px-3.5 text-base sm:min-h-8 sm:w-fit sm:text-sm"
          onClick={() => {
            void recordOwnerEvent({
              type: "participation_claimed",
              email,
            });
            setClaimOpen(true);
          }}
        >
          J’ai participé à un shooting
        </Button>
      </div>
      <PhotoParticipationDialog
        email={email}
        open={claimOpen}
        onOpenChange={setClaimOpen}
      />
    </>
  );
}

function ArchiveDownloadLink({
  href,
  shootingName,
}: {
  href: string;
  shootingName: string;
}) {
  const [preparing, setPreparing] = useState(false);

  return (
    <Button
      nativeButton={false}
      disabled={preparing}
      render={
        <a
          href={href}
          aria-busy={preparing || undefined}
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              event.button !== 0
            ) {
              return;
            }
            if (preparing) {
              event.preventDefault();
              return;
            }
            // Desktop / no file-share: keep a normal download without busy state.
            if (!canAttemptArchiveShare()) return;
            event.preventDefault();
            void (async () => {
              setPreparing(true);
              try {
                const result = await shareArchiveIfPossible({
                  url: href,
                  fallbackFilename:
                    archiveFilenameFromShootingName(shootingName),
                  title: shootingName,
                });
                if (result === "aborted" || result === "shared") return;
                triggerArchiveDownload(href);
              } finally {
                setPreparing(false);
              }
            })();
          }}
        />
      }
      size="lg"
      className="min-h-11 w-full shrink-0 touch-manipulation px-3.5 text-base sm:min-h-9 sm:w-fit sm:text-sm"
    >
      <Download />
      {preparing ? "Préparation…" : "Tout télécharger (ZIP)"}
    </Button>
  );
}

function BackLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <a
      href={href}
      className="admin-link inline-flex min-h-11 w-fit touch-manipulation items-center gap-1.5 py-2 text-base sm:text-sm"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        onClick();
      }}
    >
      <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </a>
  );
}

/** Lucide-style Instagram mark — brand icons were removed from lucide-react. */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function ShootingFacts({
  shooting,
  className,
}: {
  shooting: OwnerShooting;
  className?: string;
}) {
  const facts = [
    { id: "date", icon: Calendar, label: formatDate(shooting.shotOn) },
    {
      id: "photos",
      icon: Images,
      label: photoLabel(shooting.photos.length),
    },
    ...(shooting.dogs.length > 0
      ? [
          {
            id: "dogs",
            icon: PawPrint,
            label: shooting.dogs.join(", "),
          },
        ]
      : []),
  ];

  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm leading-4",
        className,
      )}
    >
      {facts.map((fact) => {
        const Icon = fact.icon;
        return (
          <li key={fact.id} className="inline-flex items-center gap-1.5">
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {fact.label}
          </li>
        );
      })}
    </ul>
  );
}

function ListSkeleton() {
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
