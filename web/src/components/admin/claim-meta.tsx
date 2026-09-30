import { cn } from "cn";
import {
  Calendar,
  Clock,
  Inbox,
  Mail,
  PawPrint,
  type LucideIcon,
} from "lucide-react";
import {
  activeClaimLabel,
  claimFacts,
  type ClaimFactId,
} from "@/components/admin/format";
import type { PhotoClaim } from "@/lib/admin-client";

const icons: Record<ClaimFactId, LucideIcon> = {
  date: Calendar,
  received: Clock,
  dog: PawPrint,
  email: Mail,
};

export function ClaimMeta({
  claim,
  className,
}: {
  claim: PhotoClaim;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm leading-4",
        className,
      )}
    >
      {claimFacts(claim).map((fact) => {
        const Icon = icons[fact.id];
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

export function ActiveClaimCount({ count }: { count: number }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm leading-4">
      <li className="inline-flex items-center gap-1.5">
        <Inbox className="size-3.5 shrink-0" aria-hidden />
        {activeClaimLabel(count)}
      </li>
    </ul>
  );
}
