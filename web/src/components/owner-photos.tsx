import { cn } from "cn";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Images,
  PawPrint,
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
import { Button } from "@/components/ui/button";
import {
  fetchOwnerGallery,
  shootingArchiveUrl,
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
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-5">
        <a href="/" className="admin-logo" aria-label="Mozza Dog Shop">
          <img
            src="/logo.png"
            alt=""
            width="600"
            height="338"
            className="h-16 w-auto sm:h-20"
          />
        </a>
        {email ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <p className="type-caption text-paper/95 max-w-40 truncate sm:max-w-none">
              {email}
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-paper/35 text-paper hover:bg-paper/10 hover:text-paper bg-transparent"
              onClick={clearEmail}
            >
              Retour à l'accueil
            </Button>
          </div>
        ) : (
          <a href="/admin" className="admin-link">
            Espace admin
          </a>
        )}
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
          onRetry={() => setReload((value) => value + 1)}
        />
      ) : (
        <EmailGate onSubmit={submitEmail} />
      )}
    </div>
  );
}

function EmailGate({ onSubmit }: { onSubmit: (email: string) => void }) {
  return (
    <div className="admin-rise flex flex-1 flex-col items-center justify-center gap-10 py-8">
      <main className="mx-auto flex w-full max-w-md shrink-0 flex-col gap-5 px-6">
        <div className="text-paper flex flex-col gap-2 text-center">
          <h1 className="type-display">Vos photos</h1>
          <p className="type-body text-paper/95">
            Récupérez les clichés de votre shooting avec votre chien.
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
            <label htmlFor="email" className="text-sm font-medium">
              E-mail du shooting
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vous@email.com"
              className={fieldClass}
            />
            <Button type="submit" size="lg" className="mt-2 w-full">
              Voir mes photos
            </Button>
          </form>
        </div>
      </main>
      <PhotoPrints />
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
  onRetry,
}: {
  email: string;
  status: "idle" | "loading" | "error";
  shootings: OwnerShooting[] | null;
  opened: OwnerShooting | undefined;
  shootingId: string | null;
  onOpen: (id: string) => void;
  onBack: () => void;
  onRetry: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const showList = !shootingId;
  const many = (shootings?.length ?? 0) > 1;

  useEffect(() => {
    heading.current?.focus();
  }, [opened?.id, showList]);

  return (
    <main
      className={cn(
        "admin-rise mx-auto flex w-full flex-1 flex-col gap-6 px-6 pb-16 pt-4",
        opened ? "max-w-5xl" : "max-w-3xl",
      )}
    >
      {status === "error" ? (
        <>
          <h1
            ref={heading}
            tabIndex={-1}
            className="type-display text-paper outline-none"
          >
            Vos shootings
          </h1>
          <section className={panelClass}>
            <div className="flex flex-col gap-3 px-5 py-6">
              <p className="font-medium">Le service photo est indisponible.</p>
              <p className={cn("text-sm", subtleText)}>
                Réessayez dans un instant.
              </p>
              <Button type="button" className="w-fit" onClick={onRetry}>
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
              <Button
                type="button"
                variant="ghost"
                className="text-paper hover:bg-paper/10 hover:text-paper -ml-2 w-fit"
                onClick={onBack}
              >
                <ChevronLeft />
                Tous les shootings
              </Button>
            ) : null}
            <div className="flex items-start justify-between gap-4">
              <div className="text-paper flex min-w-0 flex-col gap-1.5">
                <h1
                  ref={heading}
                  tabIndex={-1}
                  className="type-display text-balance outline-none"
                >
                  {opened.name}
                </h1>
                <ShootingFacts shooting={opened} className="text-paper/85" />
              </div>
              {opened.photos.length === 0 ? null : (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    nativeButton={false}
                    render={
                      <a href={shootingArchiveUrl(email, opened.id)} download />
                    }
                    size="lg"
                    className="bg-paper text-canvas px-3 hover:bg-white"
                  >
                    <Download />
                    Télécharger les photos
                  </Button>
                </div>
              )}
            </div>
          </div>
          <section className={cn(panelClass, "p-5")}>
            <OwnerGallery shooting={opened} />
          </section>
        </>
      ) : null}

      {status !== "error" && shootingId && !opened ? (
        <div className={panelClass}>
          <ListSkeleton />
        </div>
      ) : null}

      {status !== "error" && showList ? (
        <>
          <h1
            ref={heading}
            tabIndex={-1}
            className="type-display text-paper outline-none"
          >
            Vos shootings
          </h1>
          <section className={panelClass} aria-label="Vos shootings">
            {status === "loading" || shootings === null ? (
              <ListSkeleton />
            ) : null}

            {status === "idle" && shootings && shootings.length === 0 ? (
              <div className="px-5 py-6">
                <p className="font-medium">Aucune photo pour cet e-mail</p>
                <p className={cn("mt-1 text-sm", subtleText)}>
                  Aucun shooting n’est lié à{" "}
                  <span className="text-foreground font-medium">{email}</span>{" "}
                  pour l’instant.
                </p>
              </div>
            ) : null}

            {status === "idle" && shootings && shootings.length > 0 ? (
              <ul className="divide-ink/10 divide-y">
                {shootings.map((shooting) => (
                  <li key={shooting.id}>
                    <a
                      href={`?email=${encodeURIComponent(email)}&shooting=${shooting.id}`}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey)
                          return;
                        event.preventDefault();
                        onOpen(shooting.id);
                      }}
                      className={cn(
                        "group flex items-center gap-4 px-5 py-4",
                        rowHover,
                      )}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <p className="truncate font-medium leading-5">
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
      <ul aria-hidden="true" className="divide-ink/10 divide-y">
        {[0, 1, 2].map((row) => (
          <li key={row} className="px-5 py-4">
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
