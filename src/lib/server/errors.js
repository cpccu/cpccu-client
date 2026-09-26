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

  // `VERBOSE_ERRORS` OVERRIDES `NODE_ENV`, IN BOTH DIRECTIONS (L3).
  //
  // The problem it exists for: this redaction is gated on a variable that is
  // NOT under the application's control. `NODE_ENV` is set by the build
  // (`next build` bakes in `production`) and by the platform, and a real host
  // configured to build with `NODE_ENV` unset, to `development`, or to a
  // staging/preview value serves a PRODUCTION database while taking the
  // non-redacting branch here. That is a silent, total opening of internal-detail
  // leakage — Mongo connection strings, file paths, driver stack text — and it
  // is invisible: the only symptom is that 500 bodies get more interesting, so
  // nobody reports it.
  //
  // The override is therefore checked FIRST, as an explicit string equality on
  // `'true'` (not truthiness, so `VERBOSE_ERRORS=0` or `VERBOSE_ERRORS=` does not
  // accidentally enable it), and it WINS over `NODE_ENV` in both directions:
  //  - `VERBOSE_ERRORS=true` on a production host → the raw message is returned.
  //    This is the documented escape hatch for debugging a live deployment, and
  //    it is deliberately the more dangerous setting: it must be an explicit,
  //    greppable, removable act, never a default and never a side effect.
  //  - `VERBOSE_ERRORS=false` on a host that happens to run `NODE_ENV=development`
  //    → the message IS redacted, so a mis-set environment variable on a real
  //    host can no longer leak internals. This direction is the one that fixes
  //    the actual finding.
  // When `VERBOSE_ERRORS` is absent, the previous `NODE_ENV === 'production'`
  // behaviour applies unchanged, so every existing deployment is unaffected.
  //
  // READ LAZILY, per call, like every other `process.env` read in this codebase
  // and like `COOKIE_OPTIONS` is not: a module-load capture would freeze the
  // decision before the platform's environment is fully populated.
  const verboseOverride = process.env.VERBOSE_ERRORS;
  const showRawMessage =
    verboseOverride === 'true'
      ? true
      : verboseOverride === 'false'
        ? false
        : process.env.NODE_ENV !== 'production';

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

export { ApiError, isResponsePair, toErrorResponse };
