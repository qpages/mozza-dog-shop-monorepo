import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] placeholder:text-muted-foreground focus-visible:border-[#46704C] focus-visible:ring-3 focus-visible:ring-[#46704C]/15";

type Shooting = {
  id: string;
  shotOn: string;
  dogs: {
    id: string;
    name: string;
    ownerEmail: string;
    photoCount: number;
  }[];
};

type Props = {
  defaultEmail?: string;
  defaultPassword?: string;
};

function formatDate(shotOn: string) {
  return new Date(`${shotOn}T00:00:00`).toLocaleDateString("fr-FR", {
    dateStyle: "long",
  });
}

function photoLabel(count: number) {
  return count === 1 ? "1 photo" : `${count} photos`;
}

export function AdminApp({ defaultEmail = "", defaultPassword = "" }: Props) {
  const [email, setEmail] = useState<string | null>();
  const [shootings, setShootings] = useState<Shooting[] | null>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const response = await fetch(`${apiUrl}/admin/session`, {
          credentials: "include",
        });
        if (!response.ok) {
          if (!cancelled) setEmail(null);
          return;
        }
        const body = (await response.json()) as { email: string };
        if (!cancelled) setEmail(body.email);
      } catch {
        if (!cancelled) setEmail(null);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;

    async function loadShootings() {
      try {
        const response = await fetch(`${apiUrl}/admin/shootings`, {
          credentials: "include",
        });
        if (!response.ok) return;
        const body = (await response.json()) as { shootings: Shooting[] };
        if (!cancelled) setShootings(body.shootings);
      } catch {
        if (!cancelled) setShootings([]);
      }
    }

    void loadShootings();
    return () => {
      cancelled = true;
    };
  }, [email]);

  async function logout() {
    const response = await fetch(`${apiUrl}/admin/session`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) return;
    setShootings(null);
    setEmail(null);
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
            <p className="max-w-40 truncate text-sm text-[#f6f1e6]/80 sm:max-w-none">
              {email}
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-[#f6f1e6]/35 bg-transparent text-[#f6f1e6] hover:bg-[#f6f1e6]/10 hover:text-[#f6f1e6]"
              onClick={() => void logout()}
            >
              Déconnexion
            </Button>
          </div>
        ) : null}
        {email === null ? (
          <a href="/" className="admin-link">
            Accueil
          </a>
        ) : null}
      </header>

      {email === undefined ? <main className="flex-1" /> : null}

      {email === null ? (
        <main className="admin-rise mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-6 pb-16">
          <div className="flex flex-col gap-2 text-center text-[#f6f1e6]">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Espace admin
            </h1>
            <p className="text-[#f6f1e6]/80">Connexion au backoffice.</p>
          </div>
          <div className="rounded-2xl bg-[#f6f1e6] p-5 shadow-[0_18px_40px_-22px_rgba(16,28,14,0.45)]">
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                const data = new FormData(event.currentTarget);
                const response = await fetch(`${apiUrl}/admin/session`, {
                  method: "POST",
                  credentials: "include",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    email: String(data.get("email") ?? ""),
                    password: String(data.get("password") ?? ""),
                  }),
                });
                if (!response.ok) {
                  setError("E-mail ou mot de passe incorrect.");
                  return;
                }
                const body = (await response.json()) as { email: string };
                setEmail(body.email);
              }}
            >
              <label htmlFor="admin-email" className="text-sm font-medium">
                E-mail
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="vous@email.com"
                defaultValue={defaultEmail}
                className={fieldClass}
              />
              <label htmlFor="admin-password" className="text-sm font-medium">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  defaultValue={defaultPassword}
                  className={`${fieldClass} pr-10`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  aria-label={
                    visible
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  aria-pressed={visible}
                  onClick={() => setVisible((value) => !value)}
                >
                  {visible ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              {error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : null}
              <Button type="submit" size="lg" className="mt-2 w-full">
                Entrer
              </Button>
            </form>
          </div>
        </main>
      ) : null}

      {email ? (
        <main className="admin-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 pb-16 pt-4">
          <div className="flex flex-col gap-2 text-[#f6f1e6]">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Shootings
            </h1>
            <p className="text-[#f6f1e6]/80">
              Les séances et les chiens associés.
            </p>
          </div>
          <div className="rounded-2xl bg-[#f6f1e6] p-5 shadow-[0_18px_40px_-22px_rgba(16,28,14,0.45)]">
            {shootings === null ? (
              <p className="text-muted-foreground text-sm">Chargement…</p>
            ) : null}
            {shootings?.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucun shooting pour l'instant.
              </p>
            ) : null}
            {shootings && shootings.length > 0 ? (
              <ul>
                {shootings.map((shooting) => (
                  <li
                    key={shooting.id}
                    className="border-border border-b py-4 first:pt-0 last:border-0 last:pb-0"
                  >
                    <p className="font-heading text-lg font-semibold tracking-tight">
                      {formatDate(shooting.shotOn)}
                    </p>
                    {shooting.dogs.length === 0 ? (
                      <p className="text-muted-foreground mt-2 text-sm">
                        Aucun chien.
                      </p>
                    ) : (
                      <ul className="mt-3 flex flex-col gap-2">
                        {shooting.dogs.map((dog) => (
                          <li
                            key={dog.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm"
                          >
                            <span className="font-medium">{dog.name}</span>
                            <span className="text-muted-foreground">
                              {dog.ownerEmail} · {photoLabel(dog.photoCount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </main>
      ) : null}
    </div>
  );
}
