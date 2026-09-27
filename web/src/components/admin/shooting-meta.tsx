import { cn } from "cn";
import { Calendar, Images, Users, type LucideIcon } from "lucide-react";
import { shootingFacts, type ShootingFactId } from "@/components/admin/format";
import type { Shooting } from "@/lib/admin-client";

const icons: Record<ShootingFactId, LucideIcon> = {
  date: Calendar,
  participants: Users,
  photos: Images,
};

export function ShootingMeta({
  shooting,
  className,
}: {
  shooting: Shooting;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm leading-4",
        className,
      )}
    >
      {shootingFacts(shooting).map((fact) => {
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
