"use client";

import { Award, Medal, Star, Trophy, BookOpen, HelpCircle } from "lucide-react";

const BADGE_CONFIG = {
  winner: {
    label: "1st Place",
    colorClass: "text-yellow-400",
    bgClass: "bg-gradient-to-r from-yellow-400/20 to-amber-500/20",
    borderClass: "border-yellow-400/50",
    glowClass: "shadow-yellow-400/20",
    Icon: Trophy,
  },
  "runner-up": {
    label: "2nd Place",
    colorClass: "text-orange-400",
    bgClass: "bg-gradient-to-r from-orange-400/15 to-amber-400/15",
    borderClass: "border-orange-400/50",
    glowClass: "shadow-orange-400/20",
    Icon: Medal,
  },
  "2nd-runner-up": {
    label: "3rd Place",
    colorClass: "text-amber-400",
    bgClass: "bg-gradient-to-r from-amber-500/15 to-orange-500/15",
    borderClass: "border-amber-500/50",
    glowClass: "shadow-amber-500/20",
    Icon: Award,
  },
  participation: {
    label: "Participant",
    colorClass: "text-blue-300",
    bgClass: "bg-gradient-to-r from-blue-400/15 to-indigo-400/15",
    borderClass: "border-blue-400/50",
    glowClass: "shadow-blue-400/20",
    Icon: Star,
  },
  workshop: {
    label: "Workshop",
    colorClass: "text-emerald-300",
    bgClass: "bg-gradient-to-r from-emerald-400/15 to-teal-400/15",
    borderClass: "border-emerald-400/50",
    glowClass: "shadow-emerald-400/20",
    Icon: BookOpen,
  },
};

const FALLBACK_BADGE = {
  label: "Certified",
  colorClass: "text-muted-foreground",
  bgClass: "bg-muted/40",
  borderClass: "border-border",
  glowClass: "shadow-none",
  Icon: HelpCircle,
};

export function CertificateBadge({ type, className = "" }) {
  const normalizedType = type?.trim()?.toLowerCase();
  const config = BADGE_CONFIG[normalizedType] || FALLBACK_BADGE;

  const { label, colorClass, bgClass, borderClass, glowClass, Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border shadow-md ${colorClass} ${bgClass} ${borderClass} ${glowClass} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}