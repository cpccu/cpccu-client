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
    <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-card to-card/80 shadow-xl shadow-primary/10">
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />

      {/* Verified banner */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-border/50">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          <span className="text-green-500 text-xs font-bold tracking-wide uppercase">
            Verified
          </span>
        </div>
        <div className="ml-auto">
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

      <div className="relative p-4 sm:p-6 space-y-5">
        {/* The certificate itself, scaled down to the card width */}
        <CertificatePreview
          certificate={certificate}
          templateKey={certificate.templateKey}
          signatory={signatory}
          className="rounded-xl border border-border/60 bg-white shadow-sm"
        />

        {certificate.batch && (
          <span className="text-xs text-primary font-semibold inline-block px-2 py-1 bg-primary/10 rounded-md">
            Batch {certificate.batch}
          </span>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Hash className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Certificate ID</p>
              <p className="text-sm font-mono font-bold text-foreground break-all">
                {certificate.certificateId}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Student ID</p>
              <p className="text-sm font-mono font-bold text-foreground break-all">
                {certificate.recipientId}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Issue Date</p>
              <p className="text-sm font-bold text-foreground">
                {formattedDate}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Code2 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Issued By</p>
              <p className="text-sm font-bold text-foreground">
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
        <div className="pt-4 border-t border-border/50">
          <p className="text-center text-xs text-muted-foreground">
            This certificate is verified by CPCCU — Competitive Programming Camp
            City University
          </p>
        </div>
      </div>
    </div>
  );
}
