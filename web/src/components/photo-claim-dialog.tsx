import { useState } from "react";
import { toast } from "sonner";
import { today } from "@/components/admin/format";
import {
  fieldClass,
  quietCta,
  touchControlLg,
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
import { createPhotoClaim } from "@/lib/photos-client";

type Props = {
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PhotoClaimDialog({ email, open, onOpenChange }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const minDate = (() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    local.setFullYear(local.getFullYear() - 2);
    return local.toISOString().slice(0, 10);
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && submitting) return;
        if (!next) setFeedback(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Signaler une participation</DialogTitle>
          <DialogDescription>
            Indiquez qui vous êtes, le nom du chien et la date du shooting. Nous
            vérifierons si votre e-mail est correctement associé.
          </DialogDescription>
        </DialogHeader>
        <form
          id="photo-claim-form"
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (submitting) return;
            const data = new FormData(event.currentTarget);
            const claimEmail = String(data.get("email") ?? "").trim();
            const firstName = String(data.get("firstName") ?? "").trim();
            const lastName = String(data.get("lastName") ?? "").trim();
            const dogName = String(data.get("dogName") ?? "").trim();
            const shootingDate = String(data.get("shootingDate") ?? "");
            if (
              !claimEmail ||
              !firstName ||
              !lastName ||
              !dogName ||
              !shootingDate
            )
              return;
            setFeedback(null);
            setSubmitting(true);
            try {
              const result = await createPhotoClaim({
                email: claimEmail,
                firstName,
                lastName,
                dogName,
                shootingDate,
              });
              if (!result.ok) {
                if (
                  result.reason === "already_reported" ||
                  result.reason === "too_many_pending" ||
                  result.reason === "too_many_recent" ||
                  result.reason === "rate_limited"
                ) {
                  setFeedback(result.message);
                  return;
                }
                toast.error(result.message);
                return;
              }
              toast.success("Demande envoyée. Nous vous recontacterons.");
              setSubmitting(false);
              onOpenChange(false);
            } catch {
              toast.error("Envoi impossible. Réessaie dans un instant.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="photo-claim-first-name"
              className="text-base font-medium sm:text-sm"
            >
              Prénom
            </label>
            <input
              id="photo-claim-first-name"
              name="firstName"
              type="text"
              required
              maxLength={80}
              autoComplete="given-name"
              disabled={submitting}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="photo-claim-last-name"
              className="text-base font-medium sm:text-sm"
            >
              Nom
            </label>
            <input
              id="photo-claim-last-name"
              name="lastName"
              type="text"
              required
              maxLength={80}
              autoComplete="family-name"
              disabled={submitting}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="photo-claim-email"
              className="text-base font-medium sm:text-sm"
            >
              E-mail
            </label>
            <input
              id="photo-claim-email"
              name="email"
              type="email"
              required
              maxLength={320}
              defaultValue={email}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={submitting}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="photo-claim-dog"
              className="text-base font-medium sm:text-sm"
            >
              Nom du chien
            </label>
            <input
              id="photo-claim-dog"
              name="dogName"
              type="text"
              required
              maxLength={80}
              disabled={submitting}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="photo-claim-date"
              className="text-base font-medium sm:text-sm"
            >
              Date du shooting
            </label>
            <input
              id="photo-claim-date"
              name="shootingDate"
              type="date"
              required
              defaultValue={today()}
              min={minDate}
              max={today()}
              disabled={submitting}
              className={fieldClass}
            />
          </div>
          {feedback ? (
            <p role="status" className="text-ink/80 text-sm">
              {feedback}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={quietCta}
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="photo-claim-form"
            disabled={submitting}
            className={touchControlLg}
          >
            {submitting ? "Envoi…" : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
