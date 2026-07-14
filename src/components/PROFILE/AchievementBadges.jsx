"use client";

import { useMemo, useState } from "react";

export function AchievementBadges({ badges }) {
  const uniqueBadges = useMemo(() => Array.from(new Set(badges)), [badges]);
  const [expanded, setExpanded] = useState(false);

  if (uniqueBadges.length === 0) return null;

  const visibleBadges = expanded ? uniqueBadges : uniqueBadges.slice(0, 3);
  const hiddenCount = uniqueBadges.length - visibleBadges.length;

  return (
    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Achievement badges">
      {visibleBadges.map((badge) => (
        <li
          key={badge}
          className="rounded-full border border-primary/10 bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-primary"
        >
          {badge}
        </li>
      ))}
      {hiddenCount > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full border border-primary/20 bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground transition-colors hover:border-primary/40 hover:bg-primary hover:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`Show ${hiddenCount} more achievement badges`}
          >
            +{hiddenCount} More
          </button>
        </li>
      )}
    </ul>
  );
}
