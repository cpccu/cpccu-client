/**
 * Client-side helpers for event participation.
 *
 * This file is the client's counterpart to `resolveEventParticipationWindow` in
 * `cpccu-server/src/utils/participationWindow.js`. Read this before changing
 * anything here.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ WHY THIS FILE EXISTS AT ALL, GIVEN THE SERVER ALREADY SENDS `open`
 * ---------------------------------------------------------------------------
 *
 * It would be tempting to trust the server's `open` boolean and skip this layer.
 * That would be correct for security — every write path re-resolves the window
 * server-side, so a forged `open` buys an attacker nothing — but it would leave
 * the UI unable to say WHY an action is unavailable, and "why" is the whole value
 * of showing a closed window at all.
 *
 * A participant who arrives one hour after registration closes does not need
 * "closed". They need "registration closed on 4 March". That sentence requires
 * the CLOSING INSTANT, and the closing instant requires re-deriving the state
 * from the same two inputs the server used. That is what `resolveWindowAction`
 * does.
 *
 * ⚠️ A WINDOW HAS TWO INSTANTS NOW, NOT ONE. `opensAt` and `closesAt` replaced a
 * single `deadline`, because "registration shuts at kickoff" and "registration
 * opens next week" cannot both be described by one field. `deadline` survives on
 * the wire for one release as an alias of `closesAt` and is read in exactly one
 * place (`readAction`); nothing else in the client may name it.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THE MIRROR RULE, AND WHY IT IS NOT A PARITY PROBLEM
 * ---------------------------------------------------------------------------
 *
 * This file is a MIRROR of the server's resolver, exactly as `src/lib/hackathon.js`
 * mirrors the server's `isSafeHttpUrl`. The pattern is established: the server
 * stays the gate, the client mirrors it so the *presentation* can never contradict
 * it. The two must be changed together.
 *
 * But the client deliberately recomputes rather than trusts `open`, and that is
 * the important difference: if the two implementations DO drift, the client shows
 * a stale button and the server answers 403 with a message that explains why. The
 * failure mode is an extra click, never a wrong write. That asymmetry is what
 * makes mirroring safe here.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ WHAT IS *NOT* MIRRORED
 * ---------------------------------------------------------------------------
 *
 * Nothing that decides an outcome. Specifically absent:
 *
 *   * `memberStatus === 'approved'` — that is a server fact the client does not
 *     reliably hold (the auth slice's user object may predate an approval), and
 *     guessing it produces a form that submits and then 403s. The server owns it.
 *   * "one live registration per person" — owned by a unique compound index. The
 *     client's only job is to render the 409 it gets.
 *   * team-size enforcement on submit — the server re-checks `coMembers + 1 > max`
 *     regardless of what the form believed. The checks here are for fast feedback
 *     while typing, not for correctness.
 *
 * ---------------------------------------------------------------------------
 * EXTERNAL LINK RULE
 * ---------------------------------------------------------------------------
 * Inherits `src/lib/hackathon.js`: an admin-supplied outbound target is a plain
 * `<a target="_blank" rel="noopener noreferrer">`, never `next/link`. The helpers
 * here return already-sanitised hrefs via that file's `toSafeHref`.
 */

import { toSafeHref } from './hackathon';

/**
 * The four states an action can be in, ordered from most to least available.
 *
 * `comingSoon` is separated from `closed` deliberately and is worth reading
 * twice. Both mean "not now", but they mean opposite things to a participant:
 * `closed` is a door that has shut, `comingSoon` is one that has not opened yet.
 * Collapsing them produces the classic "Registration is closed" shown three weeks
 * before an event that has not started yet, which reads as a bug and is the single
 * most common way a participation UI loses a participant's trust.
 *
 * `disabled` covers the admin simply not having switched the feature on. It is
 * distinct from `closed` for the same reason: the remedy is different (nothing to
 * do) and the copy must not imply a deadline was missed.
 */
export const ACTION_STATES = {
  OPEN: 'open',
  CLOSED: 'closed',
  COMING_SOON: 'coming-soon',
  DISABLED: 'disabled',
};

/**
 * The window sub-object shape the server sends for one action:
 *   `{ enabled, opensAt, closesAt, open }`
 *
 * ⚠️ `opensAt` AND `closesAt` EXIST, AND `deadline` IS THEIR DEPRECATED ALIAS.
 * A window is not a single cutoff — registration that opens next week and closes
 * at kickoff is the ordinary case, so one instant could not describe it. The
 * server still emits `deadline` (meaning `closesAt`) for one release; it is read
 * here as a fallback so a payload carrying only the old name still resolves, and
 * it is named NOWHERE ELSE IN THE CLIENT. Delete the `??` once the alias is gone
 * from the wire.
 *
 * Either instant is `null` BOTH when none is configured AND when the stored value
 * could not be parsed — the server's resolver fails closed in the second case but
 * cannot express it, because a `Date` that will not parse is reported as "no
 * cutoff" rather than as an error. So `opensAt === null` does NOT mean "not
 * configured yet". Only `open === false` tells you the action is unavailable,
 * and when it is, the honest reason may be either.
 *
 * That ambiguity is why `resolveWindowAction` treats a `null` instant as
 * "nothing to tell the member" rather than inventing a date. Guessing a date is
 * worse than omitting one.
 */
const readAction = (window, action) => {
  const source = window?.[action];
  // `?? deadline` on the CLOSE side only — `opensAt` is new with the rename and
  // never had an alias, so there is nothing older to fall back to.
  const closesAt = source?.closesAt ?? source?.deadline;

  return {
    enabled: source?.enabled === true,
    opensAt: typeof source?.opensAt === 'string' ? source.opensAt : null,
    closesAt: typeof closesAt === 'string' ? closesAt : null,
    // Trusted, because the server computed it from the same stored event every
    // write path re-reads. See the header comment on why the client mirrors it.
    open: source?.open === true,
  };
};

/**
 * Turns one window action into a state plus a human explanation.
 *
 * @param {object} window  the `data` from `GET /participation/events/:eventId`
 * @param {'registration'|'submission'} action
 * @param {number} [now]   injectable clock, for tests and for a caller that
 *                         already owns one. Omit it in components: pass nothing
 *                         and the current time is read once, here.
 *
 * @returns {{
 *   state: string,        // one of ACTION_STATES
 *   open: boolean,
 *   enabled: boolean,
 *   opensAt: string|null,
 *   closesAt: string|null,
 *   reason: string|null,  // null unless the action is unavailable
 * }}
 *
 * ⚠️ CALLER RULE: this reads `now` once per call and it is NOT a hook. A component
 * that renders a deadline countdown must NOT call this inside a timer and expect
 * the result to change — it will, because the comparison is against `Date.now()`,
 * but only if something re-renders. If you need a ticking boundary, drive it with
 * `useHackathonPhase`-style state and re-call this on the tick, or you will render
 * a window that flipped shut while the page sat open. That exact staleness bug
 * already happened once on `/hackathon` and is documented at length in
 * `src/hooks/use-hackathon-phase.js`.
 */
export const resolveWindowAction = (window, action, now) => {
  const { enabled, opensAt, closesAt, open } = readAction(window, action);
  const label = action === 'registration' ? 'Registration' : 'Submission';

  if (open) {
    return { state: ACTION_STATES.OPEN, open: true, enabled, opensAt, closesAt, reason: null };
  }

  // Not switched on by an admin. Distinguished from every other closed state
  // because there is nothing for a participant to do about it and nothing to wait
  // for — saying "closed" would invent a cutoff nobody set.
  if (!enabled) {
    return {
      state: ACTION_STATES.DISABLED,
      open: false,
      enabled: false,
      opensAt,
      closesAt,
      reason: null,
    };
  }

  // Switched on but not open: either the window has not opened yet, or it has
  // already closed. The two are separated by the OPENING instant, and the test
  // for "not yet" is `now < opensAt` — the server's own rule. It used to be
  // "the close instant is still in the future", which is the same question asked
  // about the wrong instant: a window that opens in three weeks and closes in
  // four would have been reported as `closed`, and the page would have told a
  // member registration had ended three weeks before it began. That sentence is
  // exactly the class of lie `ACTION_STATES.COMING_SOON` exists to prevent.
  const at = typeof now === 'number' ? now : Date.now();
  const notYetOpen =
    Boolean(opensAt) && new Date(opensAt).getTime() > at;

  // A null opening instant with `open === false` is the fail-closed case: the
  // stored `registrationOpenAt` could not be parsed, so the server reported it as
  // unset and the action is unavailable. There is no honest "coming soon" to
  // report, hence the `null` reason and the `CLOSED` fallback.
  return {
    state: notYetOpen ? ACTION_STATES.COMING_SOON : ACTION_STATES.CLOSED,
    open: false,
    enabled: true,
    opensAt,
    closesAt,
    reason: notYetOpen
      ? `${label} has not opened yet.`
      : closesAt
        ? `${label} closed on the date shown on this page.`
        : null,
  };
};

/**
 * The team-size rules for this event, in the shape a form needs.
 *
 * @returns {{
 *   min: number, max: number, clamped: boolean,
 *   soloAllowed: boolean,
 *   // How the form should present itself. See below.
 *   mode: 'solo' | 'team' | 'either',
 * }}
 *
 * ⚠️ `mode` IS THE WHOLE REASON THIS HELPER EXISTS, and getting it wrong is the
 * most visible way to get this feature wrong.
 *
 *   * `team`     — `min >= 2`. Registering alone is REFUSED by the server with a
 *                  400. The form must therefore not offer a "register alone"
 *                  option at all; offering one and then failing on submit is
 *                  worse than not offering it.
 *   * `solo`     — `min === 1 && max === 1`. The event is strictly individual. A
 *                  team picker here is noise, and the server would accept members
 *                  only to fail the max check.
 *   * `either`   — everything else. Solo and team are both valid, so the form
 *                  starts as solo and lets the member add teammates.
 *
 * The default is `min: 1, max: 5` when the window is missing entirely, which is
 * `either` — the permissive mode. That is the right failure direction: a missing
 * window should produce a usable form, not a broken one, and the server still
 * enforces the real bounds on submit.
 */
export const resolveTeamRules = (window) => {
  const team = window?.team;
  const min = Number.isInteger(team?.minSize) && team.minSize > 0 ? team.minSize : 1;
  const max =
    Number.isInteger(team?.maxSize) && team.maxSize > 0 ? team.maxSize : Math.max(min, 5);

  // Mirrors the server's `Math.max(min, max)`. An admin who inverts the pair
  // gets a CLAMPED window, not a rejection, so the client must clamp too or it
  // would tell someone they may add teammates when `max < min` says otherwise.
  const effectiveMax = Math.max(min, max);

  let mode = 'either';
  if (min >= 2) mode = 'team';
  else if (effectiveMax === 1) mode = 'solo';

  return {
    min,
    max: effectiveMax,
    clamped: team?.clamped === true || max < min,
    soloAllowed: min < 2,
    mode,
  };
};

/**
 * Submission statuses the member may still edit.
 *
 * ⚠️ THIS IS A UX HINT, NOT A GATE. The server refuses an edit to a
 * `shortlisted` or `rejected` submission with a 409, and no client can change
 * that. The list exists so the form can disable itself and explain, rather than
 * letting someone fill in five fields and then telling them it is too late.
 *
 * Note what is NOT in the list: there is no member-facing delete, and no
 * replacement submission either. `registrationId` carries a UNIQUE index, so a
 * second submission for the same registration is permanently impossible — a
 * rejected entry is final, and `reviewNote` is the only feedback the participant
 * ever gets. That is a product decision made server-side; do not build UI that
 * implies otherwise.
 */
const EDITABLE_SUBMISSION_STATUSES = new Set(['submitted']);

export const isSubmissionEditable = (submission) =>
  !submission || EDITABLE_SUBMISSION_STATUSES.has(submission.status);

/**
 * Human copy for a submission status.
 *
 * `reviewNote` is appended by the SERVER (`toWireOwnSubmission` emits it
 * deliberately) and is the participant's only feedback after a rejection, so it
 * is surfaced prominently by the form rather than buried in a table cell.
 */
export const describeSubmissionStatus = (submission) => {
  switch (submission?.status) {
    case 'shortlisted':
      return 'Shortlisted — this entry has been published on the winners list.';
    case 'rejected':
      return submission.reviewNote
        ? `Not shortlisted. Reviewer note: ${submission.reviewNote}`
        : 'Not shortlisted. No reviewer note was left.';
    case 'submitted':
    default:
      return 'Submitted and awaiting review.';
  }
};

/**
 * Normalises the technologies list the way the server's `normalizeTechnologies`
 * does: trim, drop empties and non-strings, de-duplicate case-insensitively
 * while keeping the first spelling, and cap the length.
 *
 * ⚠️ This exists so the chips the member sees are the chips that will be stored.
 * Without it the server silently drops entry 21 and quietly collapses `React` and
 * `react` into one, and the member's list does not match what they submitted —
 * which reads as data loss even though the stored value was correct.
 *
 * The server's `MAX_TECHNOLOGIES` and its 32-character per-entry limit are
 * mirrored here for the same reason. The server remains the gate.
 */
const MAX_TECHNOLOGIES = 20;
const MAX_TECHNOLOGY_LENGTH = 32;

export const normalizeTechnologies = (input) => {
  if (!Array.isArray(input)) return [];

  const seen = new Set();
  const result = [];

  for (const entry of input) {
    if (typeof entry !== 'string') continue;

    const value = entry.trim();
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(value.slice(0, MAX_TECHNOLOGY_LENGTH));

    if (result.length >= MAX_TECHNOLOGIES) break;
  }

  return result;
};

/**
 * Coerces a comma / Enter / semicolon separated string into a technologies array.
 *
 * Splits on commas and semicolons because both are natural separators in a text
 * box and neither appears inside a technology name in practice. Enter is handled
 * separately, at the input, as a submit action rather than a delimiter.
 */
export const parseTechnologies = (raw) =>
  normalizeTechnologies(String(raw ?? '').split(/[,;]/));

/**
 * Mirrors the server's `normalizeTeamName`: trim, collapse internal whitespace,
 * and cap at the same 80 characters so the length a member sees as accepted is
 * the length that will be stored.
 *
 * Note the server may store 79 after the cap if cutting splits a surrogate pair.
 * That is not worth reproducing — an emoji-bearing team name is not a thing this
 * platform has to get byte-exact, and the server's own comment says so.
 */
const MAX_TEAM_NAME_LENGTH = 80;

export const normalizeTeamName = (raw) =>
  String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_TEAM_NAME_LENGTH);

/**
 * Where the Register button should point.
 *
 * ⚠️ THIS IS THE "ADMIN PICKS PER EVENT" DECISION, AND IT IS MADE IN EXACTLY ONE
 * PLACE. The rule, restated so it cannot be misremembered:
 *
 *   `registrationEnabled === true`  → the in-app registration page
 *   otherwise, if an external URL exists → that URL, unchanged
 *   otherwise → no button at all
 *
 * `registrationEnabled` is therefore the mode switch AND the API gate, which is
 * why no new schema field was introduced for the choice. It also means the
 * fallback is automatic and total: an event that predates this feature has
 * `registrationEnabled` absent (Mongoose's `default: false` applies to documents
 * read without the field) and keeps rendering its Google Form link exactly as it
 * does today, with no migration and no admin action. The in-app flow only takes
 * over for an event whose admin has deliberately switched participation on.
 *
 * ⚠️ DO NOT INVERT THIS TO "external URL wins". The two are not alternatives a
 * user picks between at the moment of clicking — they are an admin setting that
 * must not contradict itself. If both an external URL and `registrationEnabled`
 * are present, the admin has switched the event onto the in-app flow, and the
 * stale URL is a leftover from before. Silently preferring it would mean the
 * admin's most recent, most deliberate action is the one that gets ignored.
 *
 * @param {object} args
 * @param {object} args.window  participation window (`data` from the window endpoint)
 * @param {string} [args.externalUrl]  the event's admin-authored external link
 * @returns {{ kind: 'in-app'|'external'|'none', href: string, external: boolean }}
 */
export const resolveRegistrationTarget = ({ window, externalUrl } = {}) => {
  const action = resolveWindowAction(window, 'registration');

  // In-app wins whenever participation is enabled AND the window is currently
  // open. When the admin has enabled participation but it is shut, we still
  // return `in-app` so the detail page can render the "closed, and here's why"
  // panel — pointing at a Google Form instead would be a lie about where
  // registration happens.
  if (action.enabled) {
    return { kind: 'in-app', href: '', external: false };
  }

  const safe = toSafeHref(externalUrl);
  if (safe) {
    return { kind: 'external', href: safe, external: true };
  }

  return { kind: 'none', href: '', external: false };
};

/**
 * The same decision for submissions.
 *
 * Separate from `resolveRegistrationTarget` even though the rule is identical,
 * because the two are configured by DIFFERENT admin fields with different
 * lifetimes: registration is `registrationEnabled`, submission is
 * `submissionEnabled` + `hackathonSubmissionUrl`. Sharing one function with a
 * mode argument would make it possible to pass the wrong pair, and the resulting
 * bug — showing the external submission form on an event whose in-app
 * submissions are closed — is invisible until someone tries to submit.
 */
export const resolveSubmissionTarget = ({ window, externalUrl } = {}) => {
  const action = resolveWindowAction(window, 'submission');

  if (action.enabled) {
    return { kind: 'in-app', href: '', external: false };
  }

  const safe = toSafeHref(externalUrl);
  if (safe) {
    return { kind: 'external', href: safe, external: true };
  }

  return { kind: 'none', href: '', external: false };
};

/**
 * Extracts a message from an RTK Query rejection.
 *
 * ⚠️ THE SERVER HAS NO MACHINE-READABLE ERROR CODES — every participation error
 * is `{ status, message, errors }` with a prose `message` and nothing else. There
 * is no `code` to branch on, so a component cannot ask "is this ALREADY_REGISTERED"
 * and must either render `message` verbatim or match on it, which is brittle.
 *
 * Rendering the server's message verbatim is the right call here, and it is not a
 * fallback: for this feature the messages were WRITTEN for participants ("No member
 * found for student ID: 22109999.", "That name is already taken for this event.
 * Please choose a different one."). Re-deriving them client-side would mean
 * maintaining a second copy of every rule's wording and drifting from the server
 * on the first one anybody edited.
 *
 * The only substitution made is the generic 500, which carries a raw driver or
 * Mongoose message. That is never shown to a participant — it leaks schema and
 * driver internals, and it is not written for humans.
 */
export const getParticipationErrorMessage = (error, fallback) => {
  const message = error?.data?.message || error?.data?.errors?.[0]?.message;

  // ⚠️ THE SUBSTITUTION IS DRIVEN BY THE PRESENCE OF A PARSED BODY, NOT BY THE
  // STATUS CODE. The reasoning, because getting it wrong is a real leak:
  //
  // The global handler has two 500 branches. One wraps a deliberate `ApiError`
  // and carries `{ status, message, errors }` with a message WRITTEN FOR A HUMAN
  // ("Registration is not open for this event."). The other is the catch-all
  // fallback and carries `{ status, message }` where `message` is
  // `err.message` from Mongoose or the Mongo driver — a collection name, a schema
  // path, a CastError.
  //
  // Keying on `status === 500` therefore hides BOTH, which means every deliberate
  // 500 loses a perfectly good explanation. Keying on `data.errors` distinguishes
  // them exactly: the `ApiError` branch always sends `errors` (possibly empty, but
  // present), and the raw branch never does. So a 500 WITH an `errors` key is a
  // message written for a participant, and a 500 WITHOUT one is an internal
  // detail that must not reach the page.
  const isInternalFailure =
    message !== undefined && error?.data?.errors === undefined;

  if (isInternalFailure) {
    return fallback;
  }

  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
};

/**
 * Picks the registration a member already holds for an event, or `null`.
 *
 * ⚠️ WITHDRAWN REGISTRATIONS ARE DELIBERATELY EXCLUDED, and the exclusion is in
 * this helper rather than at each call site because forgetting it has a bad
 * visible effect: the member sees "You are registered" for a registration they
 * withdrew, and a Submit button that 409s.
 *
 * Re-registering after withdrawing is allowed and intended — the unique index is
 * partial on `status: 'registered'`, so a withdrawal frees the member to enter
 * again — which is exactly why "the newest registration for this event" is the
 * right question rather than "any registration for this event".
 */
export const findActiveRegistration = (registrations, eventId) => {
  if (!Array.isArray(registrations) || !eventId) return null;

  const target = String(eventId);

  return (
    registrations.find(
      (registration) =>
        String(registration?.eventId) === target && registration?.status === 'registered'
    ) ?? null
  );
};