/**
 * Reading and explaining the Event schedule.
 *
 * ⚠️ THE PARTICIPATION GATE IS RESOLVED SERVER-SIDE AND THIS MODULE DOES NOT
 * RE-DERIVE IT. The server owns `resolveEventParticipationWindow` in
 * `cpccu-server/src/utils/participationWindow.js`; every write path re-runs it,
 * and it — not anything here — decides whether a registration or a submission is
 * accepted. What this module does is READ the resolved window the server already
 * sent and turn it into labels and sentences a participant can act on.
 *
 * The distinction matters because the two are easy to confuse. A component that
 * computed "is registration open?" from `eventStartAt` / `eventEndAt` would be
 * building a SECOND gate that can disagree with the server the moment an admin
 * sets an explicit `registrationOpenAt`, and it would disagree in the direction
 * that looks like a bug to the member. The honest split is:
 *
 *   `src/lib/participation.js`  — mirrors the server's state machine (open /
 *     closed / coming-soon / disabled). It answers "may I, and if not why".
 *   THIS FILE                    — formats and describes. It never answers
 *     "may I".
 *
 * ---------------------------------------------------------------------------
 * THE TWELVE FIELDS, AND WHY THEY ARE DECLARED HERE RATHER THAN IN A COMPONENT
 * ---------------------------------------------------------------------------
 *
 * Six instants:
 *   eventStartAt  eventEndAt
 *   registrationOpenAt  registrationCloseAt
 *   submissionOpenAt    submissionCloseAt
 *
 * Four "follows the event" toggles:
 *   registrationOpenFollowsEventStart  → registrationOpenAt  ← eventStartAt
 *   registrationCloseFollowsEventStart → registrationCloseAt ← eventStartAt
 *   submissionOpenFollowsEventStart    → submissionOpenAt    ← eventStartAt
 *   submissionCloseFollowsEventEnd     → submissionCloseAt   ← eventEndAt
 *
 * Two master switches:
 *   registrationEnabled  submissionEnabled
 *
 * The follow toggles are resolved by the SERVER AT WRITE TIME: it overwrites the
 * target field with the merged anchor instant whenever the toggle is true. So an
 * admin ticking "same as event start" never has to type the date, and the client
 * has nothing to compute — it only has to send the toggle.
 *
 * The lists below exist so the admin forms render from ONE description of the
 * contract. The server applies an admin save as `$set: req.body`, so a field a
 * form forgets to send is UNSET with a 200 and no error anywhere; a form that
 * iterates these declarations cannot forget a field.
 *
 * FORMATING IS DHAKA. Every timestamp is rendered through `src/lib/dhaka-time.js`
 * because that is the module the rest of this feature already renders instants
 * with, and an event schedule shown in two different zones on the same page is
 * the exact class of lie this repo keeps documenting against.
 */

import { formatDhakaDateTime } from './dhaka-time';

/** Shown when an instant is genuinely unknown, rather than rendered as "Invalid Date". */
export const UNKNOWN_INSTANT = 'To be announced';

/**
 * The six instants on an Event, in the order an admin reads them.
 *
 * `required` mirrors the server's schema: the two event instants are required
 * (an event with no window cannot be scheduled at all), the four window instants
 * are optional — an absent one means "no cutoff", which is a real, intended
 * state and not a missing value.
 */
export const EVENT_SCHEDULE_FIELDS = [
  { key: 'eventStartAt', label: 'Event starts', required: true },
  { key: 'eventEndAt', label: 'Event ends', required: true },
  { key: 'registrationOpenAt', label: 'Registration opens', required: false },
  { key: 'registrationCloseAt', label: 'Registration closes', required: false },
  { key: 'submissionOpenAt', label: 'Submission opens', required: false },
  { key: 'submissionCloseAt', label: 'Submission closes', required: false },
];

/**
 * The four follow toggles.
 *
 * `anchorField` is the instant the server writes into `targetField` when the
 * toggle is true — it is needed by the admin UI to SHOW what a ticked toggle
 * currently resolves to, and it is the reason the four window instants are
 * optional in practice: "closes when the event starts" needs no typed date.
 *
 * `label` is what the checkbox says. The two registration toggles anchor on the
 * event START and the submission-close toggle anchors on the event END, which is
 * the difference between "registration shuts at kickoff" and "submissions close
 * at the closing ceremony".
 */
export const FOLLOW_TOGGLE_FIELDS = [
  {
    toggleField: 'registrationOpenFollowsEventStart',
    targetField: 'registrationOpenAt',
    anchorField: 'eventStartAt',
    label: 'Same as event start',
  },
  {
    toggleField: 'registrationCloseFollowsEventStart',
    targetField: 'registrationCloseAt',
    anchorField: 'eventStartAt',
    label: 'Same as event start',
  },
  {
    toggleField: 'submissionOpenFollowsEventStart',
    targetField: 'submissionOpenAt',
    anchorField: 'eventStartAt',
    label: 'Same as event start',
  },
  {
    toggleField: 'submissionCloseFollowsEventEnd',
    targetField: 'submissionCloseAt',
    anchorField: 'eventEndAt',
    label: 'Same as event end',
  },
];

/**
 * The two master switches, kept as a list so a form that renders "participation"
 * has one place to read the pair from.
 */
export const PARTICIPATION_SWITCHES = [
  { key: 'registrationEnabled', label: 'In-app registration' },
  { key: 'submissionEnabled', label: 'In-app submissions' },
];

/**
 * Normalises one instant out of a raw Event document.
 *
 * `?? null` collapses the three shapes a stored value can arrive in — an ISO
 * string from Mongo, `''` from an untouched form field, and `undefined` from a
 * document written before the field existed — to the single value every caller
 * here treats as "not set". The blank check is on the TRIMMED string so a
 * whitespace-only form field does not become a truthy instant.
 */
const instantOf = (value) => {
  if (typeof value !== 'string') {
    return value ? new Date(value).toISOString() : null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed).getTime();

  return Number.isNaN(parsed) ? null : trimmed;
};

/**
 * The twelve schedule fields off a raw Event document, in one object.
 *
 * ⚠️ READ, NEVER RESOLVED. A follow toggle that is true does NOT make the target
 * instant here equal the anchor — that overwrite happened on the server at write
 * time and the value read back is whatever the server stored then. If the anchor
 * is edited afterwards the stored target goes stale until the next save; the
 * server's write-time merge is the authority and this function simply reports
 * what is there.
 *
 * Booleans are coerced with `=== true` rather than a truthiness test, mirroring
 * `src/lib/public-content.js`: a document written before a field existed reads
 * as `undefined`, and `undefined` must mean "off", not "maybe".
 */
export const readEventSchedule = (event) => ({
  eventStartAt: instantOf(event?.eventStartAt),
  eventEndAt: instantOf(event?.eventEndAt),
  registrationOpenAt: instantOf(event?.registrationOpenAt),
  registrationCloseAt: instantOf(event?.registrationCloseAt),
  submissionOpenAt: instantOf(event?.submissionOpenAt),
  submissionCloseAt: instantOf(event?.submissionCloseAt),
  registrationEnabled: event?.registrationEnabled === true,
  registrationOpenFollowsEventStart: event?.registrationOpenFollowsEventStart === true,
  registrationCloseFollowsEventStart: event?.registrationCloseFollowsEventStart === true,
  submissionEnabled: event?.submissionEnabled === true,
  submissionOpenFollowsEventStart: event?.submissionOpenFollowsEventStart === true,
  submissionCloseFollowsEventEnd: event?.submissionCloseFollowsEventEnd === true,
});

/**
 * One action's sub-object out of a participation window.
 *
 * Returns `{ enabled, opensAt, closesAt, open }` — no state, no reason. Deciding
 * the state is `resolveWindowAction`'s job in `src/lib/participation.js`, which
 * owns the server mirror; duplicating that here would be the second gate the
 * module docstring rules out.
 *
 * ⚠️ `closesAt ?? deadline` — `deadline` IS A DEPRECATED ALIAS the server still
 * emits for one release, and it means the SAME instant. The canonical name is
 * read first, so a payload carrying both (or carrying only the old name, which
 * is every document written before the rename) still resolves. The alias is
 * accepted here and NOWHERE ELSE in the client: no component names it, and the
 * next release can delete this one `??`.
 */
export const readParticipationWindow = (window, action) => {
  const source = window?.[action];
  const closesAt = source?.closesAt ?? source?.deadline;

  return {
    enabled: source?.enabled === true,
    opensAt: typeof source?.opensAt === 'string' ? source.opensAt : null,
    closesAt: typeof closesAt === 'string' ? closesAt : null,
    // Trusted, because the server computed it from the same stored event every
    // write path re-reads.
    open: source?.open === true,
  };
};

/**
 * One instant as a Dhaka wall-clock string, or the caller's fallback.
 *
 * The parse is repeated here rather than taken from `formatDhakaDateTime`, which
 * cannot report failure — it substitutes its own `'To be announced'`. A caller
 * that wants a different sentence for a missing instant ("Not scheduled",
 * "The organisers have not set a cutoff") needs to be able to tell the two apart,
 * and a `formatDhakaDateTime(x) !== UNKNOWN_INSTANT` comparison would break the
 * moment that sentence is edited.
 */
export const formatInstant = (value, fallback = UNKNOWN_INSTANT) => {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? fallback : formatDhakaDateTime(value);
};

/**
 * A window as one readable range.
 *
 * Only `from` → `Opens {from}` etc. are avoided deliberately: "Opens" is a
 * registration/submission verb, and this helper is also used for a plain event
 * schedule, so it stays neutral. Returns the fallback when neither end is known.
 */
export const formatInstantRange = (from, to, fallback = UNKNOWN_INSTANT) => {
  const start = formatInstant(from, null);
  const end = formatInstant(to, null);

  if (start && end) return `${start} → ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;

  return fallback;
};

/**
 * Turns a RESOLVED action — the object `resolveWindowAction` returns — into the
 * strings a card renders.
 *
 * ⚠️ THIS TAKES THE RESOLVED OBJECT RATHER THAN THE RAW WINDOW ON PURPOSE. The
 * state (`open` / `coming-soon` / `closed` / `disabled`) is decided once, in the
 * file that mirrors the server. Accepting `(window, action)` here would mean
 * re-deciding it, and the copy below would then be keyed on a rule that is not
 * the server's.
 *
 * The states are matched by their `ACTION_STATES` string values, which are the
 * wire-visible literals rather than the enum object — `src/lib/participation.js`
 * cannot be imported from here without pulling in `./hackathon`, and the
 * dependency direction of the feature is the other way round.
 *
 * Every copy answers the question a participant actually has, and each one names
 * the instant it is talking about. `unavailableCopy` is null when there is no
 * instant to name, which is the honest answer: "the organisers have not set a
 * cutoff" is not the same sentence as "it closed on 4 March", and guessing one
 * from the other is how a participation UI loses a member's trust.
 */
export const describeParticipationWindow = (resolved) => {
  const enabled = resolved?.enabled === true;
  const open = resolved?.open === true;
  const opensAt = resolved?.opensAt ?? null;
  const closesAt = resolved?.closesAt ?? null;
  const state = resolved?.state ?? null;

  const unavailableCopy =
    !enabled || open
      ? null
      : state === 'coming-soon'
        ? opensAt
          ? `Opens ${formatInstant(opensAt)}.`
          : 'Not open yet.'
        : closesAt
          ? `Closed on ${formatInstant(closesAt)}.`
          : null;

  return {
    enabled,
    open,
    state,
    opensAt,
    closesAt,
    /** "Opens 01 Oct 2026, 09:30", or null when the instant is unknown. */
    opensCopy: opensAt ? `Opens ${formatInstant(opensAt)}` : null,
    /** "Closes 04 Oct 2026, 18:00", or null when the instant is unknown. */
    closesCopy: closesAt ? `Closes ${formatInstant(closesAt)}` : null,
    /** The window as one range, or null when neither end is known. */
    rangeCopy:
      opensAt || closesAt ? formatInstantRange(opensAt, closesAt, null) : null,
    /**
     * What to say when the window is not open right now — and ONLY in that case.
     * A null here means "nothing useful to add", which is the correct output for
     * an open window and for an admin who never configured a cutoff.
     */
    unavailableCopy,
  };
};