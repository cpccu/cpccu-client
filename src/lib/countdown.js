/**
 * Hackathon countdown arithmetic.
 *
 * Deliberately pure: no React, no timers, no `Date.now()` read outside a
 * default argument, no module-level mutable state. That keeps the file
 * verifiable by inspection (there is no frontend test runner in this repo —
 * see doc.md §11.3 — so "testable by reading" is the only testing there is).
 *
 * ⚠️ `getCountdownPhase` is a CLIENT MIRROR of `resolveHackathonPhase` in
 * `cpccu-server/src/controllers/content.controller.js`. The two must never
 * drift: the server decides the phase once at request time and ships it as
 * `phase`; the client re-derives it every second so the UI can cross a
 * boundary (upcoming → live → ended) without a refetch. If the server's
 * boundaries change, change this file in the same commit.
 */

/** Milliseconds in one day. Kept as a named constant so the split below is
 *  readable without inlining magic numbers. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_SECOND = 1000;

/**
 * Parses a date-ish value to epoch milliseconds, or `null` when it is absent
 * or unparseable.
 *
 * Two separate rejection tests, and the distinction is load-bearing:
 * `if (!value)` handles the absent cases (`null`, `undefined`, `''`), and
 * `Number.isNaN(parsed)` handles the unparseable ones (`'not-a-date'`, a
 * malformed ISO string) — a truthiness test on `parsed` would not, because
 * `new Date('not-a-date').getTime()` is `NaN`, which is falsy, so it would
 * coincidentally pass; and a valid epoch of `0` is ALSO falsy, so a
 * `if (!parsed)` test would wrongly reject it.
 *
 * ⚠️ CONSEQUENCE, DELIBERATE: because the absent-check is `!value`, a literal
 * numeric `0` (epoch 1970) is treated as absent, not as a valid instant. That
 * is a genuine edge — and it is kept on purpose, because the server's
 * `toDate` in `content.controller.js` starts with the identical
 * `if (!value) return null`. Matching the server is the point of this file.
 * Real records carry `Date` objects, serialised to ISO strings, so a numeric
 * `0` never reaches here. Do not "fix" this locally: doing so would make the
 * client resolve a phase the server does not.
 */
const toEpochMs = (value) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Resolves the lifecycle phase of a scheduled window.
 *
 *   now <  start            -> 'upcoming'
 *   start <= now <= end     -> 'live'     (boundaries inclusive)
 *   now >  end              -> 'ended'
 *   missing/unparseable date, or end <= start -> 'unannounced'
 *
 * 'unannounced' is the "we cannot honestly draw a countdown" state. It still
 * renders title/description/venue upstream, but shows no counter and never
 * releases the problem set — there is no trustworthy window to measure.
 */
export const getCountdownPhase = ({ date, endDate, now = Date.now() } = {}) => {
  // BRANCH 1: an absent or unparseable start means the schedule is not
  // publishable. `unannounced` is chosen over a guess, because a wrong
  // "upcoming" phase would show a countdown to a moment that does not exist.
  const start = toEpochMs(date);

  if (start === null) {
    return 'unannounced';
  }

  const end = toEpochMs(endDate);

  // BRANCH 2: an unparseable end, or an end that is not strictly after the
  // start, is a data error rather than a lifecycle state. `endDate` is
  // `required: true` in the schema, but documents edited directly in Mongo
  // can still violate it, and an inverted window has no meaningful middle.
  if (end === null || end <= start) {
    return 'unannounced';
  }

  // BRANCH 3: strictly before the start. Note `now < start`, not `<=`:
  // the start instant itself already belongs to 'live' (inclusive boundary).
  if (now < start) {
    return 'upcoming';
  }

  // BRANCH 4: strictly after the end, for the same inclusivity reason.
  if (now > end) {
    return 'ended';
  }

  // BRANCH 5: start <= now <= end.
  return 'live';
};

/**
 * THE CLIENT MIRROR OF THE SERVER'S `isProblemSetReleased` GATE.
 *
 * The server releases the problem set URL when, and only when, the START
 * instant is valid and in the past — it deliberately ignores `endDate` so that
 * participants can still read the set after the closing ceremony. This helper
 * is deliberately the SAME predicate and NOT `phase === 'live' || 'ended'`:
 * deriving it from `phase` made the client disagree with the server for a
 * record whose window is valid-start/invalid-end, because `phase` resolves
 * that record to `'unannounced'` while the server would still answer 200.
 *
 * Fail-closed: an absent or unparseable start returns `false`, so the request
 * is never even issued rather than being issued and 403'd.
 *
 * The SERVER REMAINS THE AUTHORITY. This predicate only decides whether to
 * OFFER the affordance; the endpoint is still protected by `verifyToken` and
 * re-checks the same rule server-side. The two agreeing is not accidental —
 * it is this file's stated job of mirroring the server (see the module
 * docstring), and any change to the server's gate must be made here too.
 */
export const hasHackathonStarted = ({ date, now = Date.now() } = {}) => {
  const start = toEpochMs(date);

  if (start === null) {
    return false;
  }

  // `>=` rather than `>`: the start instant itself already counts as started,
  // matching the server's `Date.now() >= startsAt.getTime()`.
  return now >= start;
};

/**
 * Milliseconds remaining until `target`, clamped at 0.
 *
 * The clamp matters for the tick that fires *after* the deadline: a negative
 * remaining value would render "-1 seconds" for one frame. Returns `null` when
 * the target is unusable so callers can render the "unannounced" copy instead
 * of a fake counter.
 */
export const getRemainingMs = ({ target, now = Date.now() } = {}) => {
  const targetMs = toEpochMs(target);

  if (targetMs === null) {
    return null;
  }

  return Math.max(0, targetMs - now);
};

/**
 * Splits a duration in milliseconds into whole days / hours / minutes /
 * seconds.
 *
 * Each unit is floored against the *next larger* divisor, so the parts sum back
 * to the total without an off-by-one second drift. Worked example:
 * 90_061ms = 1m 30.061s → { days: 0, hours: 0, minutes: 1, seconds: 30 }, and
 * 1 + 30 = 31 whole seconds shown, the remaining 0.061s never being displayed.
 * (The modulo is what carries each part back into its own range, so hours can
 * never read 25 or minutes 75 no matter how large `totalMs` is.)
 *
 * Returns `null` for a non-finite input so a bad target propagates as "no
 * counter" instead of as NaN in the DOM.
 */
export const splitDuration = (totalMs) => {
  if (!Number.isFinite(totalMs)) {
    return null;
  }

  const clamped = Math.max(0, totalMs);

  return {
    days: Math.floor(clamped / MS_PER_DAY),
    hours: Math.floor((clamped / MS_PER_HOUR) % 24),
    minutes: Math.floor((clamped / MS_PER_MINUTE) % 60),
    seconds: Math.floor((clamped / MS_PER_SECOND) % 60),
  };
};

/**
 * Ordered unit vocabulary for the compact (non-boxed) countdown string.
 *
 * The suffix set (`d` / `h` / `m` / `s`) is fixed here, not at the call site, so
 * every surface that renders a compact countdown abbreviates identically.
 * The ORDER is significant: it is the descending order the zero-trimming in
 * `formatDurationCompact` relies on, and the descending order a reader
 * instinctively expects in a duration.
 */
const COMPACT_UNITS = [
  { key: 'days', suffix: 'd' },
  { key: 'hours', suffix: 'h' },
  { key: 'minutes', suffix: 'm' },
  { key: 'seconds', suffix: 's' },
];

/**
 * Renders a `splitDuration` result as a compact, single-line duration string.
 *
 * ⚠️ THE UNIT-SELECTION RULE (owner request: "countdown should be fully shown"):
 * show EVERY remaining unit from the largest non-zero one down to `s`.
 *
 *   - LEADING zero units are dropped, and only leading ones. A duration of one
 *     day must not read "0d 1h 4m 9s": the "0d" is noise in front of a number
 *     that carries no information, and it is the thing that makes a countdown
 *     look like a placeholder. So "0d 14h 32m 18s" renders "14h 32m 18s".
 *   - INTERIOR zeros are KEPT. Once the largest unit is non-zero the remaining
 *     units are part of the magnitude and are printed as-is, so "2d 0h 0m 0s"
 *     is a correct and useful reading ("two days exactly, nothing less") and it
 *     is the frame immediately before the clock rolls to "1d 23h 59m 59s".
 *     Dropping interior zeros would render 2d and 1d23h59m59s as the same
 *     "2d"-ish string and hide the difference the reader is there to see.
 *   - `s` is ALWAYS present while a counter is live. It is the only unit that
 *     changes on every tick, so dropping it anywhere above the first hour would
 *     leave the badge apparently frozen ("3h 22m" looks identical 59 times in a
 *     row). The visible tick is the point of the widget.
 *
 * Consequently the string's LENGTH varies with magnitude (1 to 4 units) and
 * only ever grows toward 4 as the hackathon approaches; `tabular-nums` on the
 * consumer keeps the digits from nudging the nav row as it changes shape.
 *
 * ⚠️ THE ALL-ZERO FALLBACK IS "0s", AND IT IS NOT THE "TICKING 0s" THAT IS
 * BANNED. `formatDurationCompact` never decides that a hackathon has no
 * schedule — callers must handle `unannounced` / an unusable target BEFORE
 * reaching this function (the nav badge renders the static "TBA", the page
 * renders "Schedule to be announced"). "0s" is only reachable from a genuinely
 * zero `remaining`, which per `getCountdownPhase` is the single instant the
 * `live` window closes: `now === endAt` is inclusive-live, so exactly one
 * render may read "0s" before the next tick resolves the phase to `ended`. That
 * is an honest report of "ends right now", not a counter standing in for an
 * unknown schedule.
 *
 * No arithmetic happens here — this is a formatter over an already-split
 * duration, so the unit maths stays in `splitDuration` above and the date maths
 * in `getRemainingMs`.
 */
export const formatDurationCompact = (parts) => {
  if (!parts) {
    return '';
  }

  const firstNonZero = COMPACT_UNITS.findIndex(({ key }) => (parts[key] ?? 0) > 0);

  // Everything is zero — see the all-zero note above. Fall back to the seconds
  // slot alone rather than printing "0d 0h 0m 0s", which would look broken.
  if (firstNonZero === -1) {
    return '0s';
  }

  return COMPACT_UNITS.slice(firstNonZero)
    .map(({ key, suffix }) => `${parts[key]}${suffix}`)
    .join(' ');
};

/**
 * The instant a countdown should be measuring towards for a given phase, or
 * `null` when the phase has no countdown.
 *
 * 'ended' deliberately returns `null`: the owner explicitly does not want an
 * elapsed-time counter once the hackathon is over, and 'unannounced' has no
 * trustworthy window to count to.
 */
export const getCountdownTarget = ({ phase, startAt, endAt } = {}) => {
  if (phase === 'upcoming') {
    return startAt ?? null;
  }

  if (phase === 'live') {
    return endAt ?? null;
  }

  return null;
};
