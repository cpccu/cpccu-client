import { cn } from "@/lib/utils";

const statusStyles = {
  Active: "bg-success/10 text-success",
  Executive: "bg-accent text-accent-foreground",
  Alumni: "bg-muted text-muted-foreground",
};

export function SectionCard({ title, icon: Icon, children, className, id }) {
  return (
    <section
      id={id}
      aria-label={title}
      className={cn(
        "h-full rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow duration-300 hover:shadow-md md:p-7",
        className,
      )}
    >
      <div className="mb-5 flex items-center gap-3">
        {Icon && (
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
        )}
        <h2 className="font-serif text-lg font-bold text-foreground md:text-xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-6 py-10 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
    </div>
  );
}
