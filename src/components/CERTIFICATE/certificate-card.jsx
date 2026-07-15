"use client";

import { CertificateBadge } from "./certificate-badge";
import {
  CalendarDays,
  User,
  Hash,
  Code2,
  CheckCircle2,
} from "lucide-react";

const CONTEST_TYPE_LABELS = {
  "programming-contest": "Programming Contest",
  hackathon: "Hackathon",
  workshop: "Workshop",
  "article-writing": "Article Writing Contest",
};

export function CertificateCard({ certificate }) {

  const formattedDate = new Date(certificate.issueDate).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

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

      {/* Certificate body */}
      <div className="p-6 space-y-5">
        {/* Name and contest */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-mono uppercase tracking-wider">
            This certifies that
          </p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground text-balance">
            {certificate.recipientName}
          </h2>
          {certificate.batch && (
            <span className="text-xs text-primary font-semibold mt-1 inline-block px-2 py-1 bg-primary/10 rounded-md">
              Batch {certificate.batch}
            </span>
          )}
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {certificate.description}
          </p>
        </div>

        {/* Contest name */}
        <div className="rounded-xl bg-gradient-to-br from-muted/80 to-muted/40 border border-border/60 px-5 py-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Contest / Event
          </p>
          <p className="text-lg font-bold text-foreground">
            {certificate.contestName}
          </p>
          <span className="text-xs text-primary font-semibold mt-2 inline-block px-2 py-1 bg-primary/10 rounded-md">
            {CONTEST_TYPE_LABELS[certificate.contestType]}
          </span>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Hash className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Certificate ID</p>
              <p className="text-sm font-mono font-bold text-foreground">
                {certificate.certificateId}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Student ID</p>
              <p className="text-sm font-mono font-bold text-foreground">
                {certificate.recipientId}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-primary" />
            </div>
            <div>
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
            <div>
              <p className="text-xs text-muted-foreground">Issued By</p>
              <p className="text-sm font-bold text-foreground">
                {certificate.issuedBy}
              </p>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="pt-4 border-t border-border/50">
          <p className="text-center text-xs text-muted-foreground">
            This certificate is verified by CPCCU — Competitive Programming Camp City University
          </p>
        </div>
      </div>
    </div>
  );
}
