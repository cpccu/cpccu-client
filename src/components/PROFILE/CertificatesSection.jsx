"use client";

import Link from "next/link";
import {
  Award,
  BadgeCheck,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, SectionCard } from "./SectionCard";
import { getAchievementBadgeStyle } from "@/lib/certificates";
import { DownloadCertificateButton } from "@/components/CERTIFICATE/download-certificate-button";

function CertificateCardSkeleton() {
  return (
    <li className="flex flex-col rounded-lg border border-border bg-card p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="size-10 rounded-lg bg-muted" />
        <div className="flex flex-col items-end gap-1.5">
          <div className="h-5 w-20 rounded-full bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
      </div>
      <div className="mt-3 h-4 w-3/4 rounded bg-muted" />
      <div className="mt-1 h-3 w-1/2 rounded bg-muted" />
      <div className="mt-1 h-3 w-2/3 rounded bg-muted" />
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap gap-2">
          <div className="h-8 w-28 rounded-lg bg-muted" />
          <div className="h-8 w-20 rounded-lg bg-muted" />
          <div className="h-8 w-28 rounded-lg bg-muted" />
        </div>
      </div>
    </li>
  );
}

export function CertificatesSection({ certificates, isLoading }) {
  const showLoading = isLoading && certificates.length === 0;

  return (
    <SectionCard title="Certificates" icon={Award} id="certificates">
      {showLoading ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CertificateCardSkeleton key={i} />
          ))}
        </ul>
      ) : certificates.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No Certificates Yet"
          description="Participate in CPCCU events to earn certificates."
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
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold",
                      getAchievementBadgeStyle(cert.achievementBadge),
                    )}
                  >
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
              {cert.certificateId && (
                <p className="mt-1 text-[11px] font-mono text-muted-foreground/60">
                  {cert.certificateId}
                </p>
              )}
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

                  {/* ⚠️ THE SERVER'S FLAG IS THE ONLY GATE. `canDownload` comes
                      from `GET /certificates/me` on the member's own profile;
                      another member's profile is a public view and carries no
                      flag at all, so a visitor never gets a download button. */}
                  {cert.canDownload === true ? (
                    <DownloadCertificateButton
                      certificate={cert}
                      variant="outline"
                      size="sm"
                      className="h-auto rounded-lg px-3 py-1.5 text-xs font-bold"
                    />
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
