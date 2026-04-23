"use client";

import { CertificateBadge } from "./certificate-badge";
import { CalendarDays, Loader2 } from "lucide-react";
import { useGetRecentCertificatesQuery } from "@/features/certificate/certificateApi";

export function RecentCertificates() {
  const { data, isLoading } = useGetRecentCertificatesQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const recent = data?.data || [];

  if (recent.length === 0) {
    return (
      <div className="text-center py-10 border border-dashed border-border rounded-xl">
        <p className="text-sm text-muted-foreground">No recent certificates</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recent.map((cert, index) => {
        const formattedDate = new Date(cert.issueDate).toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "short",
            day: "numeric",
          },
        );

        return (
          <div
            key={cert._id || cert.certificateId}
            className="group flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-4 py-3.5 hover:border-primary/50 hover:bg-card transition-all"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-xs font-mono text-muted-foreground/60 w-4">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {cert.recipientName}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {cert.contestName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-7 sm:ml-0">
              <CertificateBadge type={cert.certificateType} />
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <CalendarDays className="w-3.5 h-3.5" />
                {formattedDate}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
