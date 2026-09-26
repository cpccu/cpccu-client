import 'server-only';

import { ContactMessage } from '@/lib/server/models/adminContent.model';
import { ApiError } from '@/lib/server/errors';
import { ApiResponse } from '@/lib/server/response';

/**
 * Port of `cpccu-server/src/controllers/contact.controller.js`, with the one
 * change the earlier phase recorded and deliberately declined: the mass
 * assignment is closed. The earlier version of this file said so in these terms
 * and shipped the vulnerability on purpose, to get a deliberate decision. The
 * decision has been made, so the flag is now a note about what changed and why.
 *
 * ============================ WHAT WAS FIXED (H2) ============================
 * The Express original — and this port until now — did
 * `ContactMessage.create(req.body)`: the WHOLE body, unvalidated, on a
 * `public: true` route. `ContactMessage` (`adminContent.model.js:162-176`)
 * declares `status` (default `'unread'`), `receivedAt` (default `Date.now`),
 * `repliedAt` and `reply` alongside the four public fields, so an anonymous
 * caller could set every one of them. The consequences were concrete:
 *  - `status: 'read'` — the message never appears in the admin inbox, i.e. the
 *    sender suppresses their own spam from the moderators meant to see it;
 *  - `receivedAt` — backdate a message to bury it, or forward-date it, corrupting
 *    the ordering the inbox sorts and displays by;
 *  - `reply` / `repliedAt` — pre-fill text that `messages-content.jsx:174-178`
 *    renders as if the CLUB had sent it. That is impersonation of the
 *    organisation, to the people reading the inbox.
 *
 * ============ DELIBERATE, DECLARED DIVERGENCE FROM THE EXPRESS ORIGINAL ============
 * This port now picks fields EXPLICITLY and validates each one, where the
 * original spread the request body. That is a behaviour change and is stated
 * here rather than buried: bodies that the original accepted silently can now be
 * rejected with a 400. The divergence is justified because the original
 * behaviour was not "accept a contact message", it was "let an unauthenticated
 * caller write ARBITRARY FIELDS on an administrative record, including text the
 * organisation is then displayed as having written". Fidelity is not owed to a
 * mass-assignment primitive, and the fix is small enough to review line by line.
 *
 * TWO FIELD-LEVEL CONSEQUENCES WORTH NAMING, so nobody discovers them as a
 * surprise: the Mongoose schema's `required: true` on the four fields is now
 * enforced by us before the write rather than by the driver at insert time (same
 * 400-class outcome, better message), and any extra key a caller sends is now
 * silently IGNORED rather than persisted. Ignoring is deliberate — rejecting
 * unknown keys would tell an anonymous caller which fields this schema knows,
 * which is exactly the enumeration this change exists to prevent.
 *
 * `contactRateLimiter` (3/min per IP) is still the only other control, and per
 * `rateLimit.js`'s own module docblock the default in-memory store is NOT a real
 * rate limiter on Vercel. That gap is H3 and is deferred by the owner; it is not
 * addressed by this handler.
 */

/**
 * Per-field caps for the public contact form.
 *
 * THE SCHEMA HAS NONE, so without these an anonymous caller could post a 4 MiB
 * "message" — the `MAX_JSON_BODY_BYTES` ceiling — into a document the admin
 * inbox then renders in full. A cap is a data-integrity control on a collection
 * whose only writer is anonymous.
 *
 * The numbers are sized to the form, not to the schema:
 *  - 200 for `name` is well past any real person's name and past any
 *    single-line display in the inbox;
 *  - 320 for `email` is the RFC 5321 maximum address length — the one number
 *    here that is a standard rather than a judgement call, and exceeding it
 *    cannot be a deliverable address anyway;
 *  - 300 for `subject` fits the inbox's single-line subject column;
 *  - 5000 for `message` is a generous multi-paragraph message that still cannot
 *    be used to write a novel into the admin UI.
 */
const CONTACT_FIELD_LIMITS = {
  name: 200,
  email: 320,
  subject: 300,
  message: 5000,
};

/**
 * Deliberately permissive but not empty: one `@`, something on each side, and a
 * dot in the domain. The address is never sent anywhere from this handler, so
 * the goal is to reject obvious garbage (a 4-character `x@x`, which is what a
 * mass-assignment probe looks like) rather than to adjudicate RFC 5322. A
 * stricter check would reject valid, deliverable exotic addresses.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates one field, returning its trimmed value.
 *
 * Presence and TYPE are both checked explicitly rather than relying on the
 * schema, because a non-string is the interesting case: `{"email": {"$ne": null}}`
 * or a numeric `message` is what a caller sends when they are probing the write,
 * and `String.prototype.trim` on a number would either throw (`TypeError`, which
 * surfaces as a 500 and tells the attacker their payload reached the handler in
 * an unexpected state) or, worse, coerce silently.
 *
 * @param {string} field the field name, used verbatim in the error message
 * @param {unknown} value the raw value from the request body
 * @returns {string} the trimmed, non-empty value
 * @throws {ApiError} 400 when the field is missing, not a string, blank, or over
 *                    its cap
 */
function readContactField(field, value) {
  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} is required and must be a string`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new ApiError(400, `${field} is required`);
  }

  const limit = CONTACT_FIELD_LIMITS[field];

  if (trimmed.length > limit) {
    throw new ApiError(400, `${field} must be ${limit} characters or fewer`);
  }

  return trimmed;
}

const createContactMessage = async (req, res) => {
  // `req.body` MAY BE ABSENT OR NOT AN OBJECT. A JSON body of `[1,2,3]` or
  // `"hello"` parses successfully, and destructuring a string yields
  // `undefined` for every named field (which the validators below reject) while
  // destructuring `null` THROWS a `TypeError` — a 500 on an anonymous, purely
  // client-caused request. Defaulting to `{}` sends both down the validated 400
  // path instead. The four reads are from a KNOWN-SHAPED object, so this is not
  // a spread of untrusted input.
  const { name, email, subject, message } = req.body || {};

  // PICKED EXPLICITLY, NEVER SPREAD. Four reads, four writes, and nothing else
  // from the body reaches the document. This is the whole fix: `status`,
  // `receivedAt`, `repliedAt` and `reply` are not settable by the caller, and
  // the schema's defaults (`'unread'`, `Date.now`) plus `timestamps` are what
  // the admin inbox sees.
  const payload = {
    name: readContactField('name', name),
    email: readContactField('email', email),
    subject: readContactField('subject', subject),
    message: readContactField('message', message),
  };

  if (!EMAIL_SHAPE.test(payload.email)) {
    throw new ApiError(400, 'email must be a valid email address');
  }

  // Named `savedMessage` rather than `message` because `message` is the
  // REQUEST field validated immediately above; shadowing it would make the
  // create() payload and the created document indistinguishable at a glance.
  const savedMessage = await ContactMessage.create(payload);

  // The response envelope is UNCHANGED from the original: 201, and
  // `{ statusCode, data, message, success }` from `ApiResponse`. The admin inbox
  // reads `data.status` / `data.receivedAt` on the documents it fetches from the
  // ADMIN list endpoint, not from this response, and the public form
  // (`ContactMain.jsx`) reads nothing but success — so the narrowed document
  // breaks no client.
  return res
    .status(201)
    .json(new ApiResponse(201, savedMessage, 'Message received'));
};

export { createContactMessage };
