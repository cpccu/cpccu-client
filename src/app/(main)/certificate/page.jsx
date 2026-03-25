import {
  ShieldCheck,
  Terminal,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
} from "lucide-react";
import { VerifyForm } from "@/components/CERTIFICATE/verify-form";
import { CertificateStats } from "@/components/CERTIFICATE/certificate-stats";
import { RecentCertificates } from "@/components/CERTIFICATE/recent-certificates";
import Link from "next/link";

export default function CertificatePage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border/50">
          {/* Background effects */}
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-20%,oklch(0.7_0.2_260/0.15),transparent)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_0%,oklch(0.65_0.25_280/0.1),transparent)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            aria-hidden="true"
            style={{
              backgroundImage: `linear-gradient(oklch(0.7 0.2 260) 1px, transparent 1px), linear-gradient(90deg, oklch(0.7 0.2 260) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />

          {/* Floating elements - hidden on mobile for performance */}
          <div
            className="absolute top-20 left-[10%] w-2 h-2 rounded-full bg-primary/40 animate-pulse hidden sm:block"
            aria-hidden="true"
          />
          <div
            className="absolute top-32 right-[15%] w-3 h-3 rounded-full bg-accent/30 animate-pulse hidden sm:block"
            style={{ animationDelay: "0.5s" }}
            aria-hidden="true"
          />
          <div
            className="absolute bottom-20 left-[20%] w-2 h-2 rounded-full bg-primary/30 animate-pulse hidden sm:block"
            style={{ animationDelay: "1s" }}
            aria-hidden="true"
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-bold font-mono tracking-widest uppercase">
              <ShieldCheck className="w-4 h-4" />
              Official Verification Portal
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground text-balance leading-[1.1] tracking-tight">
              Verify Your{" "}
              <span className="relative">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary">
                  Certificate
                </span>
                <Zap className="absolute -right-6 -top-2 w-5 h-5 text-accent animate-pulse" />
              </span>
            </h1>
            <p className="max-w-2xl mx-auto text-muted-foreground text-base md:text-lg leading-relaxed">
              Instantly verify the authenticity of certificates issued by{" "}
              <span className="text-foreground font-semibold">CPCCU</span> — the
              Competitive Programming Camp at City University. Search by
              certificate ID, recipient name, or student ID.
            </p>
          </div>
        </section>

        {/* Main content */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Left: Verify form */}
            <div className="lg:col-span-3 space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  Verify a Certificate
                </h2>
                <p className="text-sm text-muted-foreground">
                  Search by Certificate ID, recipient name, or student ID to
                  verify authenticity.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 md:p-8 shadow-xl shadow-primary/5">
                <VerifyForm />
              </div>

              {/* How it works */}
              <div className="rounded-2xl border border-border/60 bg-card/50 p-6 md:p-8 space-y-5">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                  <span className="w-6 h-[2px] bg-gradient-to-r from-primary to-accent rounded-full" />
                  How It Works
                </h3>
                <ol className="space-y-4">
                  {[
                    {
                      step: "01",
                      text: "Select your search method — by Certificate ID, Name, or Student ID.",
                    },
                    {
                      step: "02",
                      text: "Enter the relevant details in the search field above.",
                    },
                    {
                      step: "03",
                      text: 'Click "Verify Certificate" to instantly check authenticity.',
                    },
                    {
                      step: "04",
                      text: "View full certificate details and share or download if needed.",
                    },
                  ].map(({ step, text }) => (
                    <li key={step} className="flex items-start gap-4 group">
                      <span className="font-mono text-xs font-bold text-primary-foreground bg-gradient-to-br from-primary to-accent px-2.5 py-1 rounded-lg shrink-0 shadow-md shadow-primary/20">
                        {step}
                      </span>
                      <p className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                        {text}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Right: Stats and recent */}
            <div className="lg:col-span-2 space-y-10">
              {/* Stats */}
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Our Impact
                </h2>
                <CertificateStats />
              </div>

              {/* Recent certificates */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">
                    Recent Certificates
                  </h2>
                  <span className="text-xs text-primary/80 font-mono bg-primary/10 px-2 py-1 rounded-md">
                    Latest
                  </span>
                </div>
                <RecentCertificates />
              </div>

              {/* Info card */}
              <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-6 space-y-3">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Need Help?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Questions about a certificate? Contact us at{" "}
                  <a
                    href="mailto:cpccu.club@gmail.com"
                    className="text-primary font-medium hover:underline"
                  >
                    cpccu.club@gmail.com
                  </a>{" "}
                  or call{" "}
                  <span className="font-mono text-foreground">
                    +88017177-91358
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
