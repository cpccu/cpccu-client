'use client';

import { useEffect, useState } from 'react';
import { getCountdownPhase } from '@/lib/countdown';

/**
 * THE single source of the hackathon phase for every client component.
 *
 * ⚠️ WHY THIS HOOK EXISTS — read before touching any hackathon component.
 * The server resolves the phase ONCE, at request time, and ships it as
 * `phase`. A visitor who leaves the tab open across `startAt` (or `endAt`)
 * would therefore never see the change: nothing on the client re-reads the
 * clock, and no timer invalidates the `{ type: 'PublicContent', id: 'hackathon' }`
 * RTK Query tag, so the payload can only change on a hard refresh.
 *
 * That produced a page that contradicted itself the instant it went live: the
 * countdown said "Ends in", the registration CTA still said "Registrations are
 * open", and the problem-set panel still said "will be available when the
 * hackathon starts" — for a signed-in member, no problem set at all.
 *
 * The fix is to make the ticking phase and the panels' phase come from ONE
 * place, so they cannot disagree. `getCountdownPhase` is pure and
 * server-mirroring; this hook is the only component that owns a clock, and
 * every hackathon component reads its phase from here.
 *
 * WHY `now` IS `null` BEFORE MOUNT (do not "simplify" this away):
 * reading the clock during render would make the first client render differ
 * from the server's HTML — a React hydration mismatch. So `now` starts as
 * `null` and the server's verdict is used verbatim until the first tick. A
 * component that needs a neutral pre-mount state (the countdown's skeleton)
 * can key off `now === null` exactly as `HackathonCountdown` did before this
 * hook existed; that behaviour is unchanged.
 *
 * Returns `{ now, phase }`:
 *   now   — epoch ms, or `null` before mount. Components that need to show a
 *           neutral placeholder must check for `null` rather than assume a number.
 *   phase — `now === null ? serverPhase : getCountdownPhase(...)`.
 */
export function useHackathonPhase({ startAt, endAt, serverPhase } = {}) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    // Set synchronously on mount so the first paint after hydration already has
    // a real clock rather than waiting a full second for the interval.
    setNow(Date.now());

    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  // The server is the seed; the local clock takes over once it exists. Both
  // sides of this ternary MUST use the same rule, which is why it is written
  // once here instead of being re-derived inside each component.
  const phase =
    now === null
      ? serverPhase
      : getCountdownPhase({ date: startAt, endDate: endAt, now });

  return { now, phase };
}

export default useHackathonPhase;
