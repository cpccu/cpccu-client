import { Award, CalendarCheck, FolderGit2, HandHeart, Trophy } from "lucide-react";
import { AnimatedCounter } from "./AnimatedCounter";

export function QuickStats({ stats }) {
  const items = [
    { label: "Certificates", value: stats.certificates, icon: Award },
    { label: "Contributions", value: stats.contributions, icon: HandHeart },
    { label: "Projects", value: stats.projects, icon: FolderGit2 },
    { label: "Events", value: stats.events, icon: CalendarCheck },
    { label: "Achievements", value: stats.achievements, icon: Trophy },
  ];

  return (
    <section aria-label="Quick statistics">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
        {items.map(({ label, value, icon: Icon }) => (
          <li
            key={label}
            className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md md:p-5"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <p className="mt-3 font-serif text-3xl font-bold leading-none text-foreground" aria-label={typeof value === 'number' ? `${value.toLocaleString()} ${label}` : `${label}: ${value}`}>
              {typeof value === 'string' ? (
                <span className="text-muted-foreground/60">{value}</span>
              ) : (
                <AnimatedCounter value={value} />
              )}
            </p>
            <p className="mt-1.5 text-xs font-bold text-muted-foreground">{label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
