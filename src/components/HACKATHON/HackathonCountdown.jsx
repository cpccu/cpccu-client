"use client";

import { useMemo } from "react";
import { getCountdownTarget, getRemainingMs, splitDuration } from "@/lib/countdown";
import { useHackathonPhase } from "@/hooks/use-hackathon-phase";

/**
 * Presentational countdown for the hackathon page.
 *
 * Props:
 *   phase   — the SERVER's `phase` string, used only as the pre-mount seed
 *   startAt — UTC ISO string of the start instant
 *   endAt   — UTC ISO string of the end instant
 *
 * WHY IT RE-DERIVES THE PHASE INSTEAD OF TRUSTING THE PROP:
 * the server resolves the phase once, at request time. A visitor who leaves the
 * tab open across the start or end instant would otherwise keep seeing
 * "Starts in 00:00:03" forever. `useHackathonPhase` re-runs the (pure,
 * server-mirroring) `getCountdownPhase` on every tick, which makes the
 * transition happen locally, with no refetch and no extra endpoint.
 *
 * ⚠️ THE PHASE MUST COME FROM `useHackathonPhase`, NOT FROM A LOCAL `Date.now()`.
 * `HackathonRegistrationCta` and `HackathonProblemSet` read their phase from
 * the same hook. When the countdown owned its own clock and the panels used
 * the raw server prop, the page contradicted itself the moment it went live:
 * the countdown said "Ends in" while the CTA still said "Registrations are
 * open" and the problem set stayed unreleased until a hard refresh. One source
 * for the ticking phase is what prevents that.
 *
 * WHY NOTHING REAL RENDERS BEFORE MOUNT:
 * `now` is `null` until the hook's effect runs. The first client render
 * therefore matches the server's HTML exactly, and the real numbers appear one
 * tick later. This is the same hydration-safety pattern already used by
 * `UpComingEventCard.jsx:156-165`; reading the clock during render is what
 * produces React hydration mismatches. The neutral pre-mount skeleton below is
 * correct and must not be "simplified" into a phase-specific claim.
 *
 * The arithmetic itself (`target - Date.now()`) is pure elapsed-time maths on
 * epoch milliseconds, so it is timezone-independent BY CONSTRUCTION — a
 * visitor in any timezone sees the same number of seconds remaining.
 */

const UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hr" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Sec" },
];

/**
 * Coarse, human-scale remaining-time sentence for screen readers.
 *
 * ⚠️ Generated ONLY from a whole-minute bucket, never from the ticking digits.
 * A per-second live region is unusable (and hostile) for a screen-reader
 * user, so the sentence is stable for as long as the bucket holds: "about 2
 * days left", then "about 1 hour left", then "less than a minute left". The
 * countdown digits themselves are `aria-hidden` for the same reason.
 *
 * EXPORTED so `NavHackathonCountdown` announces the same coarse sentence
 * rather than keeping a second, subtly different copy of the same policy. One
 * helper, one accessibility rule.
 */
export const describeRemaining = (remaining) => {
  if (remaining === null) return "";

  const HOUR = 60 * 60 * 1000;
  const MINUTE = 60 * 1000;

  if (remaining >= 24 * HOUR) {
    return `more than ${Math.floor(remaining / (24 * HOUR))} days left`;
  }
  if (remaining >= HOUR) {
    const hours = Math.floor(remaining / HOUR);
    return `about ${hours} ${hours === 1 ? "hour" : "hours"} left`;
  }
  if (remaining >= MINUTE) {
    const minutes = Math.floor(remaining / MINUTE);
    return `about ${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
  }
  return "less than a minute left";
};

export default function HackathonCountdown({ phase, startAt, endAt }) {
  const { now, phase: activePhase } = useHackathonPhase({
    startAt,
    endAt,
    serverPhase: phase,
  });

  // 'ended' intentionally has no target: the owner explicitly does not want an
  // elapsed counter once the hackathon is over. 'unannounced' has no
  // trustworthy window to count towards either.
  const target = getCountdownTarget({ phase: activePhase, startAt, endAt });
  const remaining = target && now !== null ? getRemainingMs({ target, now }) : null;
  const parts = remaining === null ? null : splitDuration(remaining);

  // The sr-only sentence is keyed on WHOLE MINUTES, not on `remaining` itself.
  // `remaining` changes every second; this bucket changes at most once a
  // minute, so the accessible text is regenerated once a minute instead of
  // sixty times — which is the entire point of keeping the live region off.
  const remainingMinuteBucket =
    remaining === null ? null : Math.floor(remaining / 60000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const coarseRemaining = useMemo(() => describeRemaining(remaining), [
    remainingMinuteBucket,
  ]);

  if (activePhase === "ended") {
    return (
      <section className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card px-6 py-5">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">
          Hackathon has ended
        </h2>
        <p className="text-muted-foreground">
          Thank you for taking part. Recordings, results and certificates will
          be announced by the club.
        </p>
      </section>
    );
  }

  if (activePhase === "unannounced" || (now !== null && !parts)) {
    // The second condition is a data-error fallback: the phase says
    // upcoming/live but the target instant is unusable, so there is no
    // trustworthy window to count to. This matches the server's own rule that
    // an unparseable date resolves to 'unannounced'.
    return (
      <section className="flex flex-col items-start gap-2">
        <p className="text-lg font-bold text-p-text md:text-xl">
          Schedule to be announced
        </p>
        <p className="text-muted-foreground">
          The organisers have not published a confirmed start and end time yet.
        </p>
      </section>
    );
  }

  // Pre-mount placeholder. The server-rendered frame has no clock, so it must
  // not claim a phase-specific fact — showing "Schedule to be announced" for a
  // hackathon that is merely upcoming would be a lie, and showing numbers
  // would be a hydration mismatch. A neutral skeleton is the honest option and
  // is replaced one tick later.
  if (!parts) {
    return (
      <section className="flex flex-col items-start gap-3">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="flex flex-wrap items-start gap-3 md:gap-5">
          {UNITS.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <div className="min-w-[3.5rem] rounded-xl border border-border bg-header px-3 py-2 text-center text-xl font-bold tabular-nums text-white md:text-2xl">
                &nbsp;
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const heading = activePhase === "live" ? "Ends in" : "Starts in";

  return (
    // `role="timer"` carries the right semantics for a value that changes on
    // its own. Its implicit `aria-live` is `off`, which is exactly the existing
    // behaviour: a ticking live region would make a screen reader announce a
    // new value every second, so the per-tick digits are hidden from
    // assistive tech and the `sr-only` sentence below carries the information
    // coarsely instead. The "Starts in" → "Ends in" transition is what the
    // heading announces, and it is reachable by the user as a normal region.
    <section
      role="timer"
      className="flex flex-col items-start gap-3"
    >
      <p className="text-lg font-bold text-p-text md:text-xl">{heading}</p>
      {/* Announced on demand, not on a timer. It changes only when the coarse
          bucket below rolls over, which is the whole point: a stable sentence
          beats one that changes sixty times a minute. */}
      <p className="sr-only">
        {`${heading}: ${coarseRemaining}.`}
      </p>
      {/* The digits themselves are decorative for AT — four bare numbers with no
          unit text read as noise ("03 11 27 04"). The labelled units below are
          kept visible but hidden from the accessibility tree along with the
          numerals they annotate. */}
      <div aria-hidden="true" className="flex flex-wrap items-start gap-3 md:gap-5">
        {UNITS.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            {/* `min-w` keeps the row from reflowing as the digits change width
                once a second — a shifting layout is far more noticeable than
                the ticking itself. */}
            <span className="min-w-[3.5rem] rounded-xl border border-border bg-header px-3 py-2 text-center text-xl font-bold tabular-nums text-white md:text-2xl">
              {String(parts[key]).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
