"use client";

import {
  formatDurationCompact,
  getCountdownTarget,
  getRemainingMs,
  splitDuration,
} from "@/lib/countdown";
import { useHackathonPhase } from "@/hooks/use-hackathon-phase";
import { describeRemaining } from "@/components/HACKATHON/HackathonCountdown";

/**
 * COMPACT hackathon countdown for the navigation entry.
 *
 * Props (identical to the panels on `/hackathon`, see `Layout/Hackathon.jsx`):
 *   phase   — the SERVER's `phase`, used only as the pre-mount seed
 *   startAt — UTC ISO string of the start instant
 *   endAt   — UTC ISO string of the end instant
 *
 * WHY A COMPACT FORM AND NOT `HackathonCountdown`'s BOXED D/H/M/S TILES:
 * the nav is a persistent landmark rendered on EVERY public page, nine entries
 * wide, next to the club name. The page component's four stacked boxes are
 * correct there because it is the page's subject; here they would dominate the
 * one thing a visitor is actually scanning for (the label) and, on the mobile
 * panel, would be wider than the label itself. So this renders ONE inline line —
 * every remaining unit, "2d 14h 32m 18s" — which keeps the whole badge to a
 * single row of `text-[10px]` next to the label. The unit-selection rule
 * (leading zeros dropped, `s` always kept) lives with the formatter in
 * `src/lib/countdown.js`; the `sr-only` sentence below is the accessible
 * counterpart and is coarse on purpose.
 *
 * ⚠️ THE ACCENT COLOUR IS PROMINENT, THE STRING IS NOT ABBREVIATED. An earlier
 * pass shipped this badge deliberately muted (`bg-gray-100 text-gray-500`) on
 * the reasoning that a nav annotation should be subordinate. The owner
 * overruled that — it read as a disabled placeholder, not as live information —
 * so it is now the site's brand-blue pill (`bg-header/10 text-header`); see
 * `BADGE_CLASS` for why that token pair and why a tint rather than a solid
 * block. The `sr-only` sentence is deliberately NOT promoted alongside it:
 * making the badge more VISIBLE must not make it more AUDIBLE, so there is
 * still no `aria-live` and the coarse sentence still regenerates at most once
 * a minute.
 *
 * The arithmetic is NOT re-derived here. `getCountdownTarget` → `getRemainingMs`
 * → `splitDuration` → `formatDurationCompact` are the same pure helpers the page
 * countdown uses, so a change to the unit maths lands in both places at once,
 * and the calendar rules (inclusive boundaries, `unannounced` on an inverted
 * window) stay in `src/lib/countdown.js` and in the server mirror it documents.
 *
 * ⚠️ THE PHASE COMES FROM `useHackathonPhase` AND MUST NOT BE RE-DERIVED HERE.
 * That hook is the single shared phase source for `HackathonCountdown`,
 * `HackathonRegistrationCta` and `HackathonProblemSet`. A nav badge that
 * resolved its own phase with a local `Date.now()` is the exact drift that was
 * already caught once: the nav would read "2d 14h 32m 18s" while the page below
 * it had already flipped to "Ends in", and the page would look
 * self-contradictory across a phase boundary. One hook, one clock, one phase.
 * See `src/hooks/use-hackathon-phase.js`.
 *
 * PHASE RULE (product decision, see the task's stated assumption):
 *   upcoming — tick down to `startAt`. "Starts in 2d 14h 32m 18s" is the thing
 *              worth advertising, and it is the same claim the page makes.
 *   live     — tick down to `endAt`. Also useful ("3h 22m 45s left") and it costs
 *              nothing extra, since the target is already phase-derived.
 *   ended    — STATIC "Ended". Not an elapsed counter: the owner explicitly
 *              does not want one (see `getCountdownTarget`), and the nav entry
 *              intentionally survives the end of the hackathon, so a static
 *              marker is what stops the link from looking stale or broken.
 *              Static text also costs nothing and announces nothing.
 *   unannounced — STATIC "TBA". Never a ticking "0s" and never a phase claim we
 *              cannot support: there is no trustworthy window to measure, so
 *              the honest badge is a neutral one.
 *
 * ONE INTERVAL PER PAGE, NOT ONE PER NAV ITEM. `NavBar` mounts `NavItem` once
 * and the list it renders is shared by the desktop row and the mobile panel
 * (the same `<ul>` is reflowed by `flex-col lg:flex-row`, not duplicated), so
 * this component instance — and therefore the hook's `setInterval` — exists
 * exactly once per page. The per-consumer interval inside the shared hook is a
 * trade-off the earlier review already accepted; it is not being restructured
 * here, and a dedicated child component (rather than an extra hook call in
 * `NavItem`) means the interval is not even created on a page with no hackathon.
 *
 * HYDRATION: nothing phase-specific renders before mount. `now` is `null` until
 * the hook's effect runs, so this returns `null` and the first client render is
 * byte-identical to the server's. This is not merely defensive: the whole nav
 * entry is hidden while the hackathon query is in flight (see `NavBar.jsx`), so
 * there is no server HTML containing the badge at all — a computed value here
 * would be a guaranteed mismatch the first time the entry did render on the
 * server. The hook sets the clock SYNCHRONOUSLY on mount, so the neutral gap is
 * not a visible frame.
 */

/**
 * The badge's visual treatment, shared by the ticking and static forms so the
 * two can never drift apart in size or weight.
 *
 * - `bg-header/10 text-header` — the site accent, and a deliberate change from
 *   the previously `bg-gray-100 text-gray-500` treatment, which read as a
 *   disabled placeholder rather than as live information.
 *   WHY THIS TOKEN PAIR AND NOT A HARDCODED COLOUR: both halves are derived
 *   from `--color-header` (`src/app/globals.css:18`, the same variable behind
 *   `text-header`, `border-header` and `bg-header` that the nav itself uses for
 *   its active item), so a theme change re-tints the badge with everything else
 *   instead of leaving a stray blue behind. The `/10` opacity modifier is
 *   Tailwind v4 colour-mix on that variable, not a second declared colour.
 *   WHY IT IS THE SITE'S OWN BADGE IDIOM, NOT AN INVENTED ONE: this is the
 *   exact pill already used for the rank/number badges in
 *   `ContributorsCarousel.jsx:317` and `DonatorsCarousel.jsx:317`
 *   ("bg-header/10 text-header … rounded-full"), and `bg-header/10` is also
 *   what `NavBar.jsx` itself uses for a sub-menu hover. So this reads as "the
 *   same kind of brand-blue chip used everywhere else", not as a new style.
 *   WHY A TINT RATHER THAN A SOLID `bg-header text-white` (the treatment the
 *   page's own countdown tiles use, and the more obvious "make it prominent"
 *   move): the nav is a persistent landmark on every public page. A saturated
 *   filled block there would out-shout the `font-bold` label it is attached to
 *   and collide with the active item's own `bg-blue-50/50` + `border-header`
 *   treatment, so the visitor's eye would land on the annotation instead of the
 *   link. The tint keeps the accent unmistakably brand-blue and high-contrast
 *   for the digits, while the label stays the loudest thing in the row.
 * - `normal-case` is load-bearing: the parent nav link carries `capitalize`,
 *   which would render the duration as "2D 14H 32M 18S" — the digits would read
 *   as an acronym rather than as a countdown.
 * - `tabular-nums` keeps every digit the same width, so the seconds ticking
 *   from 9 to 10 (or 59 to 00) does not nudge the nav row's layout once a
 *   second. `shrink-0` stops the flex parent from squeezing the badge.
 * - RESPONSIVE — the badge is still hidden below `sm`, which is 480px in THIS
 *   project (`--breakpoint-sm` in `globals.css:5`; note it is not Tailwind's
 *   stock 640px). The expanded four-unit string is roughly twice the width of
 *   the two-unit one this replaced, so the breakpoint was re-measured rather
 *   than assumed. Between `sm` (480) and `lg` (976) the badge is visible INSIDE
 *   the mobile panel, which is `w-[80%]` below `md` and `w-[50%]` from `md` up,
 *   and the nav item spends `px-6`/`md:px-8` on that row. The worst case is
 *   therefore the narrow end of that band: a 480px viewport gives a 384px panel
 *   and 336px of row, against ~244px needed for the longest string the formatter
 *   can emit ("2d 14h 32m 18s" plus the label) even using a deliberately
 *   over-generous 0.75em per-glyph advance. It fits with margin, so an
 *   abbreviated phone form would buy nothing except a second format string to
 *   keep in sync with the `sr-only` sentence below. Keeping ONE string means one
 *   formatting policy, and the badge stays an annotation that the mobile menu —
 *   which a visitor opens deliberately — does not have to carry.
 *   `hidden … sm:inline-flex`: below `sm` the label must never wrap, and the
 *   badge is the only thing that can make it — a wrapped label in a `py-4`
 *   panel row reflows the whole row.
 */
const BADGE_CLASS =
  "ml-2 hidden shrink-0 items-center rounded-full bg-header/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-wide tabular-nums text-header sm:inline-flex";

export default function NavHackathonCountdown({ phase, startAt, endAt }) {
  const { now, phase: activePhase } = useHackathonPhase({
    startAt,
    endAt,
    serverPhase: phase,
  });

  // Pre-mount / no-clock state. Neutral by design — see HYDRATION above.
  if (now === null) {
    return null;
  }

  // Same rule as the page: count towards the start while upcoming and towards
  // the end while live. 'ended' and 'unannounced' both yield `null` here, which
  // is how they reach the static branches below instead of a dead counter.
  const target = getCountdownTarget({ phase: activePhase, startAt, endAt });
  const remaining = target ? getRemainingMs({ target, now }) : null;
  const parts = remaining === null ? null : splitDuration(remaining);

  // Static, non-ticking copy. Rendered only when there is genuinely no
  // trustworthy window to count to — either the phase says so, or the phase
  // claims upcoming/live but the target instant is unusable (a data error, the
  // same fallback `HackathonCountdown` takes).
  if (activePhase === "ended") {
    return <Badge label="Ended" title="Hackathon has ended" />;
  }

  if (activePhase === "unannounced" || !parts) {
    return <Badge label="TBA" title="Hackathon schedule to be announced" />;
  }

  const { days, hours, minutes, seconds } = parts;

  // ALL remaining units, not just the two largest: the owner asked for the
  // countdown to be "fully shown", and a reader checking a deadline wants the
  // whole remaining figure at a glance. `formatDurationCompact` (in
  // `src/lib/countdown.js`, where the zero-trimming rule is documented and where
  // it can be exercised under plain `node`) drops LEADING zero units and always
  // keeps the trailing `s`, so this yields "2d 14h 32m 18s" / "14h 32m 18s" /
  // "32m 18s" / "18s" — never "0d 14h 32m 18s", and never a string without the
  // ticking seconds. `parts` is destructured here only to keep the local
  // vocabulary obvious; the formatter reads the same four keys off `parts`.
  const compact = formatDurationCompact({ days, hours, minutes, seconds });

  // The accessible alternative to the ticking digits, keyed on WHOLE MINUTES.
  // It therefore changes at most once a minute instead of sixty times, and it
  // carries no `aria-live` at all — nothing here is announced on a timer, so a
  // screen-reader user is never interrupted by a nav landmark updating itself.
  // Reuses the page's own sentence builder so the two surfaces cannot drift.
  const coarse = describeRemaining(remaining);
  const coarsePhrase = activePhase === "live" ? "ends in" : "starts in";

  return (
    <span className={BADGE_CLASS}>
      {/* Abbreviations are unreadable aloud ("two d fourteen h"), so the visible
          string is hidden from assistive tech and the coarse sentence below
          carries the meaning instead — once a minute, never per second. */}
      <span aria-hidden="true">{compact}</span>
      <span className="sr-only">{`${coarsePhrase}: ${coarse}.`}</span>
    </span>
  );
}

/**
 * The neutral static pill (`Ended` / `TBA`).
 *
 * `title` is a tooltip only — it is not the accessible name and is not
 * announced reliably, so the visible text stays self-sufficient: both strings
 * are readable on their own next to the word "Hackathon".
 */
function Badge({ label, title }) {
  return (
    <span className={BADGE_CLASS} title={title}>
      {label}
    </span>
  );
}
