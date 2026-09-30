import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const itemClass =
  "type-body flex min-h-11 items-center rounded-lg px-3 py-2.5 text-base text-ink outline-none touch-manipulation transition-colors duration-200 hover:bg-canvas/10 focus-visible:bg-canvas/10 focus-visible:ring-2 focus-visible:ring-canvas/40";

type Props = {
  email?: string | null;
  onLogout?: () => void;
};

function MenuLink({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      className={itemClass}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {label}
    </a>
  );
}

export function SiteMenu({ email, onLogout }: Props) {
  return (
    <Sheet>
      <SheetTrigger
        className="sm:hidden"
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Ouvrir le menu"
            className="text-paper hover:bg-paper/10 hover:text-paper focus-visible:border-paper/40 focus-visible:ring-paper/40 aria-expanded:bg-paper/10 aria-expanded:text-paper size-12 [&_svg:not([class*='size-'])]:size-7"
          />
        }
      >
        <Menu className="size-7" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-paper text-ink border-ink/10 shadow-paper pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]"
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="type-section text-ink text-[1.125rem]">
            Menu
          </SheetTitle>
          {email ? (
            <SheetDescription className="type-caption text-ink/60 truncate">
              {email}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <nav className="flex flex-col px-3" aria-label="Navigation principale">
          <MenuLink href="/" label="Accueil" />
          <MenuLink href="/admin" label="Espace admin" />
          <Separator className="bg-ink/10 my-2" />
          <MenuLink
            href="https://mozzadogshop.com/"
            label="Accéder à la boutique"
            external
          />
        </nav>
        {onLogout ? (
          <SheetFooter>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="border-ink/20 text-ink hover:bg-canvas/10 hover:text-ink min-h-11 w-full touch-manipulation bg-transparent text-base"
                  onClick={onLogout}
                />
              }
            >
              Déconnexion
            </SheetClose>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
