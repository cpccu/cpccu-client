/**
 * Bangladesh Standard Time (BST, UTC+6) helpers.
 *
 * Every timestamp the API deals with is an instant, and the server always sends
 * UTC ISO strings. This module is the *only* place that converts between that
 * instant and the Dhaka wall-clock an admin types into `datetime-local`.
 *
 * WHY A DEDICATED MODULE
 * ----------------------
 * Two existing helpers are both wrong for this feature and are deliberately
 * NOT used:
 *
 *   1. `src/lib/format-date.js` — its docstring claims it "formats a date
 *      string deterministically using UTC", but it calls `date-fns` `format()`
 *      on a browser-local `Date`, so it renders in the *viewer's* timezone. A
 *      viewer in Europe would see the wrong wall-clock, and because the server
 *      and the browser disagree the first paint can differ from the hydrated
 *      tree. BUG — reported, not fixed here: changing it would alter every
 *      date on the public site, which is far outside a hackathon PR.
 *   2. `new Date(value).toISOString()` on a `datetime-local` value — this is
 *      what `events-content.jsx` does, and it silently interprets the typed
 *      wall-clock in the *admin's browser* timezone. Correct for a Dhaka admin,
 *      wrong by the browser's UTC offset for any admin abroad. Left alone on
 *      purpose: changing the existing events form would rewrite the stored
 *      instant of every historical event.
 *
 * Dhaka has observed UTC+6 with no daylight saving since 2009, so a fixed
 * `+06:00` offset is exact for every date this feature can produce. It is
 * still written as an offset rather than a hard-coded subtraction because the
 * conversion below goes through the standard ISO parser.
 */

/** IANA zone. Used for *display* only, where the engine owns the offsets. */
export const DHAKA_TIME_ZONE = 'Asia/Dhaka';

/** Human-readable suffix shown next to every rendered hackathon date. */
export const DHAKA_TIME_ZONE_LABEL = 'BST, UTC+6';

/** Fixed offset used to pin admin-entered wall-clock to an instant. */
const DHAKA_UTC_OFFSET = '+06:00';

const pad = (value) => String(value).padStart(2, '0');

/**
 * Parses anything date-ish to epoch milliseconds, or `null` if unusable.
 * `Number.isNaN` is the validity test: a valid epoch of `0` is falsy.
 */
const toEpochMs = (value) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: DHAKA_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Splits an instant into its Dhaka wall-clock parts.
 * Returns `null` when the input is not a usable instant.
 */
export const getDhakaParts = (value) => {
  const epochMs = toEpochMs(value);

  if (epochMs === null) {
    return null;
  }

  // `formatToParts` rather than `toLocaleString`: the parts are needed
  // individually, and locale strings change shape between ICU versions.
  // `hourCycle: 'h23'` is set above via hour12:false so midnight is "00"
  // and not "24" (the h24 trap that would shift a midnight date by a day).
  const parts = partsFormatter.formatToParts(new Date(epochMs));
  const pick = (type) => parts.find((part) => part.type === type)?.value ?? null;

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
  };
};

/**
 * Converts an instant to the exact string shape a `datetime-local` input
 * expects: `YYYY-MM-DDTHH:mm`.
 *
 * Rendering the admin's existing value through this (rather than
 * `eventStartAt.slice(0, 16)`, which is a UTC slice) is what makes the edit form
 * show the Dhaka time the admin originally typed, rather than six hours off.
 */
export const toDhakaInputValue = (value) => {
  const parts = getDhakaParts(value);

  if (!parts) {
    return '';
  }

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

/**
 * Converts a `datetime-local` wall-clock string typed by an admin into a UTC
 * ISO string, by explicitly attaching the Dhaka offset.
 *
 * `new Date('2026-10-01T09:30+06:00')` pins 09:30 in Dhaka regardless of the
 * machine's timezone, which `new Date('2026-10-01T09:30')` does not — that
 * form is interpreted in the *host* timezone, the bug described above.
 *
 * Returns `null` for blank or malformed input so the caller can block the save
 * inline instead of posting `new Date(NaN).toISOString()` (which throws a
 * RangeError).
 */
export const utcIsoFromDhakaInput = (dhakaWallClock) => {
  if (!dhakaWallClock || typeof dhakaWallClock !== 'string') {
    return null;
  }

  const withOffset = `${dhakaWallClock}${DHAKA_UTC_OFFSET}`;
  const parsed = new Date(withOffset);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const displayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: DHAKA_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Formats an instant as a Dhaka wall-clock string, e.g. `01 Oct 2026, 09:30`.
 *
 * Returns `'To be announced'` for an unusable value so a bad record renders as
 * a dash of text rather than "Invalid Date" or an empty cell.
 */
export const formatDhakaDateTime = (value) => {
  const epochMs = toEpochMs(value);

  if (epochMs === null) {
    return 'To be announced';
  }

  return `${displayFormatter.format(new Date(epochMs))}`;
};
