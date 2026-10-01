import { Button } from "@/components/ui/button";
import { recordOwnerEvent } from "@/lib/photos-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INSTAGRAM_MESSAGE_URL = "https://ig.me/m/mozza.dog.shop";

type Props = {
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PhotoParticipationDialog({ email, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Signaler une participation</DialogTitle>
          <DialogDescription>
            Écrivez-nous un message sur Instagram pour que l’on retrouve votre
            shooting.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            nativeButton={false}
            onClick={() => {
              if (!email) return;
              void recordOwnerEvent({ type: "instagram_message", email });
            }}
            render={
              <a
                href={INSTAGRAM_MESSAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Écrire un message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
