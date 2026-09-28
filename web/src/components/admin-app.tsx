import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { LoginForm } from "@/components/admin/login-form";
import { ShootingsScreen } from "@/components/admin/shootings-screen";
import { getSession, logout } from "@/lib/admin-client";

type Props = {
  defaultEmail?: string;
  defaultPassword?: string;
};

export function AdminApp({ defaultEmail = "", defaultPassword = "" }: Props) {
  const [email, setEmail] = useState<string | null>();

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const sessionEmail = await getSession();
      if (!cancelled) setEmail(sessionEmail);
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    const ok = await logout();
    if (!ok) return;
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
            <p className="type-caption text-paper/95 max-w-40 truncate sm:max-w-none">
              {email}
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-paper/35 text-paper hover:bg-paper/10 hover:text-paper bg-transparent"
              onClick={() => void handleLogout()}
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
        <LoginForm
          defaultEmail={defaultEmail}
          defaultPassword={defaultPassword}
          onLoggedIn={setEmail}
        />
      ) : null}

      {email ? <ShootingsScreen /> : null}

      <Toaster position="bottom-right" />
    </div>
  );
}
