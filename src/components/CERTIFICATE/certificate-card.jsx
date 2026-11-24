"use client";

import { useSelector } from "react-redux";
import {
  CalendarDays,
  CheckCircle2,
  Code2,
  Hash,
  Info,
  User,
} from "lucide-react";
import { canDownloadCertificate, getCertificatesFromResponse } from "@/lib/certificates";
import { useGetMyCertificatesQuery, useGetCertificateSignatoriesQuery } from "@/features/certificate/certificateApi";
import { CertificateBadge } from "./certificate-badge";
import { CertificatePreview } from "./templates/certificate-document";
import { DownloadCertificateButton } from "./download-certificate-button";
import { resolveSignatory } from "@/lib/certificate-signatories";

const CONTEST_TYPE_LABELS = {
  "programming-contest": "Programming Contest",
  hackathon: "Hackathon",
  workshop: "Workshop",
  "article-writing": "Article Writing Contest",
};

export function CertificateCard({ certificate }) {
  const token = useSelector((state) => state.auth.token);
  const isSignedIn = Boolean(token);

  // ⚠️ THE SERVER SAYS WHO MAY DOWNLOAD. This card renders a certificate
  // from the PUBLIC verify endpoint, which carries no `canDownload` flag, so
  // the client asks `GET /certificates/me` — the one list the server scopes
  // to the signed-in member. Every card on the page shares that one query.
  const { data: myCertificates } = useGetMyCertificatesQuery(undefined, {
    skip: !isSignedIn,
  });
  const { data: signatoriesResponse } = useGetCertificateSignatoriesQuery();

  const ownCertificate = getCertificatesFromResponse(myCertificates).find(
    (mine) => mine.certificateId === certificate.certificateId,
  );
  const canDownload = canDownloadCertificate(ownCertificate);
  const signatory = resolveSignatory(signatoriesResponse, certificate?.committee);

  const formattedDate = certificate.issueDate
    ? new Date(certificate.issueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const isParticipation = certificate.certificateType === "participation";

  return (
    <div className="relative w-full max-w-full overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-card to-card/80 shadow-xl shadow-primary/10">
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />

      {/* Verified banner */}
      <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border/50">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-green-500/10 border border-green-500/30 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 shrink-0" />
          <span className="text-green-500 text-[11px] sm:text-xs font-bold tracking-wide uppercase">
            Verified
          </span>
        </div>
        <div className="ml-auto min-w-0 shrink-0">
          <CertificateBadge type={certificate.certificateType} />
        </div>
      </div>

      {/* Decorative gradient overlay */}
      <div
        className="absolute top-0 right-0 w-64 h-64 opacity-[0.08] pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 100% 0%, oklch(0.7 0.2 260), transparent 60%)",
        }}
      />

      {/* Certificate body */}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 min-w-0">
        {/* Name and contest */}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground mb-1.5 sm:mb-2 font-mono uppercase tracking-wider">
            This certifies that
          </p>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground break-words text-balance">
            {certificate.recipientName}
          </h2>
          {certificate.batch && (
            <span className="text-xs text-primary font-semibold mt-1 inline-block px-2 py-0.5 sm:py-1 bg-primary/10 rounded-md">
              Batch {certificate.batch}
            </span>
          )}
          {certificate.description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed break-words">
              {certificate.description}
            </p>
          )}
        </div>

        {/* Contest name */}
        <div className="rounded-xl bg-gradient-to-br from-muted/80 to-muted/40 border border-border/60 px-4 sm:px-5 py-3 sm:py-4 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 sm:mb-2 font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Contest / Event
          </p>
          <p className="text-base sm:text-lg font-bold text-foreground break-words">
            {certificate.contestName}
          </p>
          <span className="text-xs text-primary font-semibold mt-2 inline-block px-2 py-1 bg-primary/10 rounded-md break-words max-w-full">
            {CONTEST_TYPE_LABELS[certificate.contestType] || (certificate.contestType ? certificate.contestType.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Contest')}
          </span>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Hash className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Certificate ID</p>
              <p className="text-sm font-mono font-bold text-foreground break-all">
                {certificate.certificateId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Student ID</p>
              <p className="text-sm font-mono font-bold text-foreground break-all">
                {certificate.recipientId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Issue Date</p>
              <p className="text-sm font-bold text-foreground break-words">
                {formattedDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Code2 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Issued By</p>
              <p className="text-sm font-bold text-foreground break-words">
                {certificate.issuedBy}
              </p>
            </div>
          </div>
        </div>

        {CONTEST_TYPE_LABELS[certificate.contestType] && (
          <span className="text-xs text-primary font-semibold inline-block px-2 py-1 bg-primary/10 rounded-md">
            {CONTEST_TYPE_LABELS[certificate.contestType]}
          </span>
        )}

        {/* Download — the server's own list decides, and it says no by default */}
        <div className="pt-1">
          {canDownload ? (
            <DownloadCertificateButton
              certificate={certificate}
              signatory={signatory}
              className="w-full rounded-xl py-5 text-sm font-bold"
            />
          ) : null}

          {!isParticipation && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              Winners&apos; certificates are verified online; PDF download is
              available for participation certificates only.
            </p>
          )}

          {isParticipation && isSignedIn && !canDownload && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              Only the certificate holder can download this certificate as a
              PDF.
            </p>
          )}

          {isParticipation && !isSignedIn && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              Signed in as this certificate&apos;s holder? Sign in to download
              your PDF.
            </p>
          )}
        </div>

        {/* Footer note */}
        <div className="pt-3 sm:pt-4 border-t border-border/50">
          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            This certificate is verified by CPCCU — Competitive Programming Camp City University
          </p>
        </div>
      </div>
    </div>
  );
}
