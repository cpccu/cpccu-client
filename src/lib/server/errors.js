import 'server-only';

import { uploadSizeMessage } from '@/lib/server/constants';

/**
 * Brand carried by the `{ status, body }` pairs this module hands back, so the
 * consumer in `http.js` can recognise them UNAMBIGUOUSLY.
 *
 * WHY A BRAND AND NOT A SHAPE CHECK. A duck-typed `typeof x === 'object' &&
 * 'status' in x` test is UNSAFE for this payload, because `status` is a REAL
 * FIELD NAME in this codebase: `adminContent.model.js` defines it on `Event`
 * (`'upcoming'`), `ContactMessage` (`'unread'`) and `DeveloperProfile`
 * (`'pending'`), and `post.model.js` / `project.model.js` define it too. These
 * are exactly the ported Mongoose documents `http.js` exists to serve, and a
 * handler returning a single `Event` (a `GET` on one document) would be
 * mistaken for an error pair and serialised as `Response.json(null, { status:
 * 'upcoming' })` — a non-numeric `ResponseInit.status`, i.e. a `RangeError`,
 * i.e. a 500 with a `null` body. Arrays were unaffected, which is why the bug
 * only ever shows up on single-document GETs and reads as a data problem rather
 * than a serialisation one.
 *
 * The symbol is module-private (created here, never exported on its own) so no
 * other module can mint a pair by accident; only `responsePair` writes it, and
 * only this file calls `responsePair`. A symbol key is invisible to
 * `JSON.stringify` and to `Object.keys`, so the brand never leaks into a
 * serialised body.
 */
const RESPONSE_PAIR = Symbol('cpccu.responsePair');

/**
 * Resolves whether internal error detail may be returned to the client.
 *
 * ============================================================================
 * WHY THIS IS A SHARED EXPORT AND NOT AN INLINE EXPRESSION IN EACH CALLER
 * ============================================================================
 * TWO call sites need this decision, and they are two halves of ONE policy:
 * `toErrorResponse` below (the 500 branch), and `verifyToken` in `auth.js` (the
 * non-expiry JWT branch, which otherwise returns raw `jsonwebtoken` text such as
 * "jwt malformed" or "invalid signature"). The second one is a FORGERY ORACLE:
 * the difference between "malformed" and "invalid signature" tells an attacker
 * probing token forgery whether their forged token was structurally well-formed,
 * which is the first bit of information they need.
 *
 * `auth.js` used to gate that redaction on `process.env.NODE_ENV === 'production'`
 * alone, which is the bug this export exists to close. `NODE_ENV` is NOT under
 * the application's control — it is set by the build (`next build` bakes in
 * `production`) and by the platform — so a real host configured to build with it
 * unset, or to `development`, or to a staging value, serves a PRODUCTION
 * database while taking the non-redacting branch. The failure is invisible: the
 * only symptom is that 500 bodies and 401 bodies get more interesting, so nobody
 * reports it. This module's own comment on the 500 branch says exactly that, and
 * `VERBOSE_ERRORS` was introduced here to fix it — but the fix was never applied
 * to `auth.js`, so the two redactions in this codebase disagreed about when they
 * applied and the JWT one was the unsafe half.
 *
 * ONE RESOLUTION, ONE RULE. Keeping two copies of "is this a production host?"
 * is how the two drifted apart in the first place.
 *
 * ============================================================================
 * THE RULE ITSELF — `VERBOSE_ERRORS` OVERRIDES `NODE_ENV`, IN BOTH DIRECTIONS
 * ============================================================================
 *  - `VERBOSE_ERRORS=true` on a production host → the raw message is returned.
 *    This is the documented escape hatch for debugging a live deployment, and it
 *    is deliberately the more dangerous setting: it must be an explicit,
 *    greppable, removable act, never a default and never a side effect.
 *  - `VERBOSE_ERRORS=false` on a host that happens to run `NODE_ENV=development`
 *    → the message IS redacted, so a mis-set environment variable on a real host
 *    can no longer leak internals. This direction is the one that fixes the
 *    actual finding.
 * When `VERBOSE_ERRORS` is absent, `NODE_ENV === 'production'` decides, so every
 * existing deployment is unaffected.
 *
 * IT IS AN EXPLICIT STRING EQUALITY ON `'true'`, NOT A TRUTHINESS TEST, so
 * `VERBOSE_ERRORS=0`, `VERBOSE_ERRORS=` or `VERBOSE_ERRORS=no` do not
 * accidentally enable the dangerous branch.
 *
 * READ LAZILY, PER CALL, like every other `process.env` read in this codebase:
 * a module-load capture would freeze the decision before the platform's
 * environment is fully populated, which is the same serverless cold-start hazard
 * `db.js` and `sendEmail.js` document for their own reads.
 *
 * @returns {boolean} `true` when raw internal detail may be sent to the client
 */
function resolveVerboseErrors() {
  const verboseOverride = process.env.VERBOSE_ERRORS;

  if (verboseOverride === 'true') return true;
  if (verboseOverride === 'false') return false;

  return process.env.NODE_ENV !== 'production';
}

/**
 * Builds a branded `{ status, body }` pair. All four branches of
 * `toErrorResponse` go through here so no branch can be returned unbranded.
 */
function responsePair(status, body) {
  return { [RESPONSE_PAIR]: true, status, body };
}

/**
 * Port of `cpccu-server/src/utils/ApiError.js`.
 *
 * The three non-standard fields are kept because the serialiser and the Express
 * error handler both read them:
 *  - `statusCode` — defaults to 400 when falsy.
 *  - `data`      — always `null`; present only because callers spread it.
 *  - `error`     — a LIST of `{ field, message }` entries, defaulting to `[]`.
 *                   Note the singular property name holding a plural collection.
 *
 * `419` is a non-standard status that this codebase uses for "OTP expired"
 * (not an HTTP-registered code, but widely understood and already relied upon by
 * the client, so it is preserved). `503` (service unavailable / DB down) and
 * `502` (bad gateway) are both reachable through this class.
 */
class ApiError extends Error {
  constructor(
    statusCode,
    message = 'Something went wrong',
    error = [],
    stack = '',
  ) {
    super(message);
    this.statusCode = statusCode || 400;
    this.data = null;
    this.error = error;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Branch 2 of the Express error handler (`app.js:87-103`).
 * A Mongo duplicate-key error (code 11000) is turned into a 409 with a message
 * a human can act on, instead of the driver's default
 * "E11000 duplicate key error collection...".
 */
function duplicateKeyResponse(err) {
  const dupField = Object.keys(err.keyValue || {})[0] || 'field';
  const friendly =
    dupField === 'email'
      ? 'This email address is already registered. Please use a different email.'
      : dupField === 'uniID'
        ? 'This Student ID is already registered. Please contact an administrator if you believe this is a mistake.'
        : `${dupField} already exists.`;

  return responsePair(409, {
    status: 409,
    message: 'Validation failed',
    errors: [{ field: dupField, message: friendly }],
  });
}

/**
 * Reproduces all four branches of the Express error handler
 * (`cpccu-server/src/app.js:78-117`) as a plain `{ status, body }` pair so an
 * App Router route handler can turn it into a `Response` without an Express
 * `res` object.
 *
 * EVERY branch is returned through `responsePair`, which BRANDS the result with
 * the module-private `RESPONSE_PAIR` symbol. That is what lets `http.js`
 * recognise these pairs without a duck-typed shape check on `status` — a check
 * that is unsafe here, because `status` is a real field on the domain documents
 * these pairs travel alongside. See the `RESPONSE_PAIR` docblock.
 *
 * IMPORTANT — deliberate divergence from the Express original on branch 4.
 * Express sent `err.message` verbatim with a 500, which leaks internal detail
 * (Mongo connection strings, file paths, driver stack text) to the client. The
 * response SHAPE is preserved exactly — `{ status: 500, message }` with no
 * `errors` key — but the message is replaced with the generic
 * "Internal Server Error" in production, and the real error is logged
 * server-side instead. In non-production the raw message is kept because
 * stack-shaped 500s are the only useful signal during local development.
 *
 * That decision is overridable in BOTH directions by `VERBOSE_ERRORS`, so it no
 * longer depends on a variable the application does not control — see the
 * branch-4 comment below for why that matters and what each value does.
 */
function toErrorResponse(err) {
  // Branch 1 — body-parser's file-size guard (multer in the Express original).
  // The message is built from `MAX_UPLOAD_BYTES` rather than hard-coded, because
  // the hard-coded text said "less than 5MB" while the enforced cap is 4 MiB —
  // which told a user to retry with a file the server would reject again. It is
  // the same string `cloudinary.js` throws, so both paths now agree.
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return responsePair(400, {
      status: 400,
      message: uploadSizeMessage(),
      errors: [],
    });
  }

  // Branch 2 — unique index violation. The Express handler tested
  // `err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)`;
  // the second clause is fully subsumed by the first, so only the code test is
  // needed. Both spellings are accepted here because Mongoose 9 can surface the
  // error from either the driver or its own wrapper.
  if (
    err?.code === 11000 ||
    (err?.name === 'MongoServerError' && err?.code === 11000)
  ) {
    return duplicateKeyResponse(err);
  }

  // Branch 3 — anything we raised deliberately.
  if (err instanceof ApiError) {
    return responsePair(err.statusCode, {
      status: err.statusCode,
      message: err.message,
      errors: err.error,
    });
  }

  // Branch 4 — unhandled. NOTE: no `errors` key on this branch in the original,
  // and that asymmetry is preserved because the frontend reads `errors`
  // conditionally on some endpoints and would break if an always-present empty
  // array changed the branch.
  //
  // LOG THE REAL ERROR UNCONDITIONALLY; REDACT ONLY IN THE RESPONSE. Gating the
  // `console.error` on `NODE_ENV` (as this previously did) meant local dev and
  // preview deploys emitted NO stack trace for an unhandled error while still
  // returning the raw message to the client — so the one environment where a
  // developer is actually trying to diagnose the failure was the one with no
  // log, and the symptom was an unexplained 500 that could not be reproduced
  // anywhere. Redaction belongs on the wire, not in the operator's own logs.
  console.error('Unhandled server error:', err);

  // `VERBOSE_ERRORS` OVERRIDES `NODE_ENV`, IN BOTH DIRECTIONS. The full
  // reasoning — including why `NODE_ENV` is not a safe gate on its own — lives
  // on `resolveVerboseErrors` above, which is a SHARED export because `auth.js`
  // needs the same decision for its own redaction and the two having drifted
  // apart is what let a non-`production` host return raw `jsonwebtoken` text.
  // The call itself replaces an inline copy of that expression; the observable
  // behaviour of this function is unchanged.
  const showRawMessage = resolveVerboseErrors();

  const message = showRawMessage
    ? err?.message || 'Internal Server Error'
    : 'Internal Server Error';

  return responsePair(500, {
    status: 500,
    message,
  });
}

/**
 * Recognises a branded `{ status, body }` pair produced by `toErrorResponse` /
 * `duplicateKeyResponse`. Exported so `http.js` can test for the brand instead of
 * duck-typing on the `status` key, which is a real field on the domain documents
 * these pairs travel alongside — see the `RESPONSE_PAIR` docblock.
 */
function isResponsePair(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    value[RESPONSE_PAIR] === true &&
    typeof value.status === 'number'
  );
}

export { ApiError, isResponsePair, resolveVerboseErrors, toErrorResponse };
