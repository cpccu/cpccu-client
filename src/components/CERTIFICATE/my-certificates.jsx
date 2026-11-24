"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import { Award, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { CertificateBadge } from "./certificate-badge";
import { DownloadCertificateButton } from "./download-certificate-button";
import { useGetMyCertificatesQuery, useGetCertificateSignatoriesQuery } from "@/features/certificate/certificateApi";
import { canDownloadCertificate } from "@/lib/certificates";
import { resolveSignatory } from "@/lib/certificate-signatories";

const extractCertificates = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  return [];
};

const formatIssuedOn = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * "My certificates" — the signed-in member's own records.
 *
 * Renders nothing for an anonymous visitor: the endpoint is scoped to the
 * caller, and a publicly visible empty list would read as "you have no
 * certificates" to somebody who simply is not logged in.
 *
 * ⚠️ THE DOWNLOAD BUTTON FOLLOWS THE SERVER'S `canDownload` FLAG. This list
 * comes from `GET /certificates/me`, so the flag is the server's own answer
 * to "may this member download it" — the client adds no rule of its own.
 */
export function MyCertificates() {
  const token = useSelector((state) => state.auth.token);
  const { data, isLoading, isError, error } = useGetMyCertificatesQuery(
    undefined,
    { skip: !token }
  );
  const { data: signatoriesResponse } = useGetCertificateSignatoriesQuery();

  if (!token) return null;

  const certificates = extractCertificates(data);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" aria-hidden="true" />
          My Certificates
        </h2>
        {certificates.length > 0 && (
          <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded-md">
            {certificates.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Loading your certificates…
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error?.data?.message || "Your certificates could not be loaded."}
        </p>
      ) : certificates.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          No certificates yet. Participate in a CPCCU event to earn one.
        </p>
      ) : (
        <ul className="space-y-3">
          {certificates.map((cert) => (
            <li
              key={cert._id || cert.certificateId}
              className="rounded-xl border border-border/60 bg-background/60 p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground text-pretty">
                    {cert.contestName || "CPCCU Certificate"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatIssuedOn(cert.issueDate)}
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground/70 mt-0.5 break-all">
                    {cert.certificateId}
                  </p>
                </div>
                <CertificateBadge type={cert.certificateType} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/certificate/${cert.certificateId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  View
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </Link>

                {canDownloadCertificate(cert) ? (
                  <DownloadCertificateButton
                    certificate={cert}
                    signatory={resolveSignatory(signatoriesResponse, cert?.committee)}
                    variant="secondary"
                    size="sm"
                    className="rounded-lg text-xs font-bold"
                  />
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                    Verified online
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
