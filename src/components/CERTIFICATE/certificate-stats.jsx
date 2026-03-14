import { Award, Trophy, Users, Layers } from "lucide-react";
import { STATS } from "@/lib/certificates-data";

const stats = [
  {
    label: "Certificates Issued",
    value: STATS.totalCertificates,
    Icon: Award,
    suffix: "+",
  },
  {
    label: "Contests Held",
    value: STATS.totalContests,
    Icon: Layers,
    suffix: "+",
  },
  {
    label: "Total Participants",
    value: STATS.totalParticipants,
    Icon: Users,
    suffix: "+",
  },
  {
    label: "Winners Recognized",
    value: STATS.totalWinners,
    Icon: Trophy,
    suffix: "+",
  },
];

export function CertificateStats() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map(({ label, value, Icon, suffix }) => (
        <div
          key={label}
          className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/60 px-4 py-6 text-center hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/30 group-hover:scale-110 transition-transform">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-extrabold text-foreground font-mono">
            {value}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              {suffix}
            </span>
          </p>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}
