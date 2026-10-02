/**
 * Route-parameter helpers shared by the three participation routes.
 *
 * These exist as a named module rather than as inline checks in each page because
 * the three routes MUST agree on what a valid id looks like. When they were inline,
 * the question "what counts as a malformed id?" had three answers — and the
 * observable symptom of a disagreement is a 404 for an event that exists, which is
 * indistinguishable from a routing bug.
 *
 * ⚠️ WHY A 24-HEX-CHARACTER CHECK AND NOT THE USUAL SHORTCUTS.
 *
 * `Array.isArray` and a truthiness check are both insufficient: `Array.isArray([])`
 * is `true`, and both accept an empty string. Neither catches the actual failure
 * mode, which is a non-id string reaching a route that will pass it to a Mongo
 * `ObjectId` cast — where it becomes a `CastError`, then a 500 carrying the raw
 * driver message, per the note in `getEventParticipationWindow`.
 *
 * ⚠️ THE PATTERN IS ANCHORED AT BOTH ENDS. Without the trailing `$`, `'abc123…def'
 * would pass by matching its first 24 characters. It has to be the whole string.
 *
 * ⚠️ THIS IS A UX GUARD, NOT AUTHORISATION. It stops a malformed URL producing a
 * server error page. It grants nothing: the server re-validates with
 * `mongoose.isValidObjectId` on every request that carries an id, and that is the
 * real gate. Deleting this check would not make anything less secure — it would
 * only make a typo look like a crash.
 */

/** Matches exactly 24 hexadecimal characters — the shape of a Mongo ObjectId. */
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * True when `value` can be a route parameter for a single-event page.
 *
 * Returns `false` for anything that is not a string, which covers `undefined`
 * (before `params` is awaited) and array/object values.
 */
export const IS_EVENT_ID = (value) =>
  typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
