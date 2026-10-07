import { ArrowUpRight } from "lucide-react";
import { cn } from "cn";

const LINKS = [
  {
    href: "https://www.instagram.com/mozza.dog.shop/",
    label: "Instagram",
  },
  {
    href: "https://mozzadogshop.com/",
    label: "Boutique",
  },
  {
    href: "https://mozzadogshop.com/mentions-legales/",
    label: "Mentions légales",
  },
] as const;

type Props = {
  /** Leave the lower edge clear of the floating shop button. */
  clearShopButton?: boolean;
};

export function SiteFooter({ clearShopButton = false }: Props) {
  return (
    <footer
      className={cn(
        "relative mt-auto",
        "pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]",
        "sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))]",
        "pt-14 sm:pt-20",
        "pb-[max(1.75rem,env(safe-area-inset-bottom))]",
        clearShopButton && "sm:pb-[max(7rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="border-paper/30 mx-auto flex w-full max-w-3xl flex-col items-center border-t pt-6 text-center sm:pt-8">
        <a
          href="/"
          aria-label="Mozza Dog Shop, accueil"
          className="focus-visible:ring-paper inline-block rounded-sm opacity-90 outline-none transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 motion-reduce:transition-none"
        >
          <img
            src="/logo.png"
            alt=""
            width="600"
            height="338"
            className="h-11 w-auto sm:h-12"
          />
        </a>

        <nav
          aria-label="Pied de page"
          className="mt-3 flex flex-wrap items-center justify-center gap-x-6"
        >
          {LINKS.map((link) => (
            <FooterLink key={link.href} href={link.href}>
              {link.label}
            </FooterLink>
          ))}
        </nav>

        <a
          href="https://quentinpages.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="type-caption text-paper focus-visible:ring-paper group relative mt-1 inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2"
        >
          Développé par Quentin PAGES
          <ArrowUpRight
            className="size-3.5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
          <span className="sr-only"> (nouvel onglet)</span>
          <span
            aria-hidden="true"
            className="bg-primary pointer-events-none absolute inset-x-0 bottom-2.5 h-px"
          />
        </a>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-visible:ring-paper text-paper group relative inline-flex min-h-11 touch-manipulation items-center text-base outline-none focus-visible:ring-2 sm:text-sm"
    >
      {children}
      <span className="sr-only"> (nouvel onglet)</span>
      <span
        aria-hidden="true"
        className="bg-primary pointer-events-none absolute inset-x-0 bottom-2.5 h-px origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
      />
    </a>
  );
}
