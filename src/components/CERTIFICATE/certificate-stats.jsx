"use client";

import { Award, Trophy, Users, Layers, Loader2 } from "lucide-react";
import { useGetCertificateStatsQuery } from "@/features/certificate/certificateApi";

export function CertificateStats() {
  const { data, isLoading } = useGetCertificateStatsQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 col-span-2">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const statsData = data?.data || {
    totalCertificates: 0,
    totalContests: 0,
    totalParticipants: 0,
    totalWinners: 0,
  };

  const stats = [
    {
      label: "Certificates Issued",
      value: statsData.totalCertificates,
      Icon: Award,
      suffix: "+",
    },
    {
      label: "Contests Held",
      value: statsData.totalContests,
      Icon: Layers,
      suffix: "+",
    },
    {
      label: "Total Participants",
      value: statsData.totalParticipants,
      Icon: Users,
      suffix: "+",
    },
    {
      label: "Winners Recognized",
      value: statsData.totalWinners,
      Icon: Trophy,
      suffix: "+",
    },
  ];

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
