"use client";

import { useParams } from "next/navigation";
import { useVerifyCertificatePublicQuery } from "@/features/certificate/certificateApi";
import { CertificateCard } from "@/components/CERTIFICATE/certificate-card";
import { ShieldCheck, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function VerifyCertificatePage() {
  const { certificateId } = useParams();

  const {
    data: certificateData,
    error,
    isLoading,
  } = useVerifyCertificatePublicQuery(certificateId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !certificateData?.success) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <main className="max-w-4xl mx-auto px-4 py-20">
          <div className="text-center space-y-8">
            {/* Error icon */}
            <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-12 h-12 text-destructive" />
            </div>

            {/* Error message */}
            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                Certificate Not Found
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                We couldn't find a certificate with the ID "{certificateId}". It may be invalid or doesn't exist.
              </p>
            </div>

            {/* Certificate ID display */}
            <div className="bg-muted/50 rounded-xl p-4 max-w-sm mx-auto">
              <p className="text-sm text-muted-foreground mb-1">Certificate ID</p>
              <p className="font-mono text-foreground font-semibold">
                {certificateId}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/certificate"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                Verify Another Certificate
              </Link>
              <a
                href="mailto:cpccu.club@gmail.com"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors font-semibold"
              >
                <ExternalLink className="w-4 h-4" />
                Contact Support
              </a>
            </div>

            {/* Help text */}
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              If you believe this is an error, please contact us at{" "}
              <a
                href="mailto:cpccu.club@gmail.com"
                className="text-primary hover:underline"
              >
                cpccu.club@gmail.com
              </a>{" "}
              with your certificate details.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const certificate = certificateData.data;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <main className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        {/* Header */}
        <div className="text-center space-y-6 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/40 bg-green-500/10 text-green-600 text-sm font-bold">
            <ShieldCheck className="w-4 h-4" />
            Certificate Verified
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Certificate Verification
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            This certificate has been successfully verified as authentic and issued by CPCCU - City University.
          </p>
        </div>

        {/* Certificate display */}
        <div className="space-y-6">
          <CertificateCard certificate={certificate} />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
          <Link
            href="/certificate"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify Another Certificate
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors font-semibold"
          >
            <ExternalLink className="w-4 h-4" />
            Print Certificate
          </button>
        </div>

        {/* Footer note */}
        <div className="text-center mt-8 p-4 bg-muted/30 rounded-xl">
          <p className="text-sm text-muted-foreground">
            This verification page can be bookmarked and shared. Direct link:{" "}
            <code className="bg-muted px-2 py-1 rounded text-xs">
              {typeof window !== "undefined" ? window.location.href : ""}
            </code>
          </p>
        </div>
      </main>
    </div>
  );
}