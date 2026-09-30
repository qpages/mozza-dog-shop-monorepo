import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import {
  fieldClass,
  touchControlLg,
  touchIcon,
} from "@/components/admin/styles";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/admin-client";

type Props = {
  defaultEmail: string;
  defaultPassword: string;
  onLoggedIn: (email: string) => void;
};

export function LoginForm({
  defaultEmail,
  defaultPassword,
  onLoggedIn,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <main className="admin-rise mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-6 pb-[max(4rem,env(safe-area-inset-bottom))]">
      <div className="text-paper flex flex-col gap-2 text-center">
        <h1 className="type-display max-sm:text-2xl max-sm:leading-tight">
          Espace admin
        </h1>
        <p className="type-body text-paper/95">Connexion au backoffice.</p>
      </div>
      <div className="bg-paper shadow-paper rounded-2xl p-5">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setPending(true);
            const data = new FormData(event.currentTarget);
            try {
              const result = await login(
                String(data.get("email") ?? ""),
                String(data.get("password") ?? ""),
              );
              if (!result.ok) {
                setError(result.message);
                return;
              }
              onLoggedIn(result.email);
            } finally {
              setPending(false);
            }
          }}
        >
          <label
            htmlFor="admin-email"
            className="text-base font-medium sm:text-sm"
          >
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
          <label
            htmlFor="admin-password"
            className="text-base font-medium sm:text-sm"
          >
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
              className={`${fieldClass} pr-11 sm:pr-10`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={`absolute right-0.5 top-1/2 -translate-y-1/2 ${touchIcon} sm:size-7`}
              aria-label={
                visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
              }
              aria-pressed={visible}
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-base sm:text-sm">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className={`mt-2 w-full ${touchControlLg}`}
            disabled={pending}
          >
            {pending ? "Connexion…" : "Connexion"}
          </Button>
        </form>
      </div>
    </main>
  );
}
