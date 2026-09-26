import 'server-only';

import mongoose from 'mongoose';

/**
 * Port of `cpccu-server/src/utils/isValidIdentity.js`
 * (default -> named export).
 *
 * THE SECOND CLAUSE IS THE POINT. `mongoose.Types.ObjectId.isValid()` is far
 * more permissive than it looks: it returns `true` for ANY 12-character string
 * and for several non-hex shapes, because Mongoose will happily coerce such a
 * value to an ObjectId rather than throw. Passing one of those straight to
 * `findById()` therefore does not raise — it silently produces a query against
 * an unrelated (or nonexistent) `_id`, so a malformed id looks like "no such
 * record" and the endpoint returns a 404 instead of a 400.
 *
 * Requiring a 24-character string narrows the check to the canonical 24-hex-char
 * ObjectId representation and rejects everything else up front, which is what
 * makes this usable as a request-validation guard (and is why the source
 * performs both tests rather than just `isValid`).
 *
 * Note it does NOT verify that the id EXISTS in the database — that is a query,
 * not a shape check.
 */
function isValidIdentity(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(id).length === 24;
}

export { isValidIdentity };
