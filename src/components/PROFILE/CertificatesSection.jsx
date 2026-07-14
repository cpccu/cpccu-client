import Link from "next/link";
import { Award, BadgeCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, SectionCard } from "./SectionCard";

function getAchievementBadgeStyle(badge) {
  const normalized = badge.toLowerCase();

  if (normalized.includes("champion")) return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (normalized.includes("runner")) return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  if (normalized.includes("third")) return "bg-orange-100 text-orange-800 ring-1 ring-orange-200";
  if (normalized.includes("participant")) return "bg-blue-100 text-blue-800 ring-1 ring-blue-200";
  return "bg-purple-100 text-purple-800 ring-1 ring-purple-200";
}

export function CertificatesSection({ certificates }) {
  return (
    <SectionCard title="Certificates" icon={Award} id="certificates">
      {certificates.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certificates yet"
          description="Certificates earned through CPCCU events and contests will appear here."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {certificates.map((cert) => (
            <li
              key={cert.id}
              className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Award className="size-5" aria-hidden="true" />
                </span>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", getAchievementBadgeStyle(cert.achievementBadge))}>
                    {cert.achievementBadge}
                  </span>
                  {cert.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                      Verified
                    </span>
                  )}
                </div>
              </div>
              <h3 className="mt-3 text-sm font-bold leading-snug text-foreground text-pretty">
                {cert.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {cert.issuer} · {cert.date}
              </p>
              <div className="mt-auto pt-4">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={cert.url}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    View Certificate
                    <ExternalLink className="size-3" aria-hidden="true" />
                    <span className="sr-only">: {cert.title}</span>
                  </Link>
                  <Link
                    href={cert.url}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                  >
                    Verify
                    <BadgeCheck className="size-3" aria-hidden="true" />
                    <span className="sr-only"> certificate: {cert.title}</span>
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
