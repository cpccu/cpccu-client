const BADGE_CONFIG = {
  winner: {
    label: '1st Place',
    colorClass: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    icon: 'trophy',
  },
  'runner-up': {
    label: '2nd Place',
    colorClass: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    icon: 'medal',
  },
  '2nd-runner-up': {
    label: '3rd Place',
    colorClass: 'bg-orange-100 text-orange-800 ring-1 ring-orange-200',
    icon: 'award',
  },
  participation: {
    label: 'Participant',
    colorClass: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
    icon: 'star',
  },
  champion: {
    label: 'Champion',
    colorClass: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    icon: 'trophy',
  },
  achievement: {
    label: 'Achievement',
    colorClass: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
    icon: 'award',
  },
  workshop: {
    label: 'Workshop',
    colorClass: 'bg-green-100 text-green-800 ring-1 ring-green-200',
    icon: 'book',
  },
};

const FALLBACK_CONFIG = {
  label: 'Certified',
  colorClass: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
  icon: 'award',
};

/**
 * Get badge configuration for a certificate type.
 */
export function getCertificateBadge(certificateType) {
  if (!certificateType) return FALLBACK_CONFIG;
  const key = certificateType.trim().toLowerCase();
  return BADGE_CONFIG[key] || FALLBACK_CONFIG;
}

/**
 * Get badge label for display.
 */
export function getBadgeLabel(certificateType) {
  return getCertificateBadge(certificateType).label;
}

/**
 * Get badge color classes for styling.
 */
export function getBadgeColor(certificateType) {
  return getCertificateBadge(certificateType).colorClass;
}

/**
 * Get Tailwind color class for an achievement badge label string.
 * Used by profile certificate cards where badges are already resolved.
 */
export function getAchievementBadgeStyle(badge) {
  if (!badge) return 'bg-purple-100 text-purple-800 ring-1 ring-purple-200';

  const normalized = badge.toLowerCase();

  if (normalized.includes('1st') || normalized.includes('champion'))
    return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
  if (normalized.includes('2nd') || normalized.includes('runner'))
    return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
  if (normalized.includes('3rd') || normalized.includes('third'))
    return 'bg-orange-100 text-orange-800 ring-1 ring-orange-200';
  if (normalized.includes('participant'))
    return 'bg-blue-100 text-blue-800 ring-1 ring-blue-200';

  return 'bg-purple-100 text-purple-800 ring-1 ring-purple-200';
}
