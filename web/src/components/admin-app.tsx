import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoginForm } from "@/components/admin/login-form";
import { ShootingsScreen } from "@/components/admin/shootings-screen";
import { SiteFooter } from "@/components/site-footer";
import { SiteMenu } from "@/components/site-menu";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
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
    if (!ok) {
      toast.error("Déconnexion impossible. Réessaie dans un instant.");
      return;
    }
    setEmail(null);
  }

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:gap-4 sm:px-8 sm:py-5">
        <a href="/" className="admin-logo shrink-0" aria-label="Mozza Dog Shop">
          <img
            src="/logo.png"
            alt=""
            width="600"
            height="338"
            className="h-14 w-auto sm:h-20"
          />
        </a>
        {email ? (
          <div className="hidden items-center gap-4 sm:flex">
            <p className="type-caption text-paper/95 max-w-none truncate">
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
          <a href="/" className="admin-link hidden sm:inline">
            Accueil
          </a>
        ) : null}
        {email !== undefined ? (
          <SiteMenu
            email={email}
            onLogout={email ? () => void handleLogout() : undefined}
          />
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

      <SiteFooter />
      <Toaster position="bottom-right" />
    </div>
  );
}
