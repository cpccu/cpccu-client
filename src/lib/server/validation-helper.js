import 'server-only';

import { ApiError } from '@/lib/server/errors';
import { Certificate } from '@/lib/server/models/certificate.model';
import { User } from '@/lib/server/models/user.model';

/**
 * Port of `cpccu-server/src/utils/validation-helper.js`.
 *
 * Seven exports in three groups:
 *   - `checkDuplicate*`  — non-throwing lookups; return the conflicting
 *                          document or `null`.
 *   - `assert*Unique`     — the same check, but raising a 409 `ApiError`
 *                          carrying a `{ field, message }` list.
 *   - `buildFieldErrors`  — turns a `{ field: message }` map into the
 *                          `{ field, message }` LIST that `ApiError` expects.
 *
 * The `check*` / `assert*` split is load-bearing: the `assert*` helpers are the
 * ONLY place in the codebase that produces the "already registered" wording, and
 * controllers that need to report several conflicts at once use the `check*`
 * form and aggregate with `buildFieldErrors` instead. Do not collapse the two
 * groups.
 *
 * NOTE ON WHY THESE EXIST AT ALL: each of these fields also carries a Mongo
 * unique index (`email`, `uniID`, `certificateId`), so the database would reject
 * a duplicate anyway. The point of checking first is the ERROR: a raw
 * `E11000 duplicate key error collection: cpccu.users index: email_1` is not
 * something a user can act on, and a 500 rather than a 400. See
 * `duplicateKeyResponse` in `errors.js` for the other half of that story — the
 * index is the race-condition backstop for two concurrent requests that both
 * pass this check.
 */

/**
 * Email is matched case-insensitively and after trimming.
 *
 * Lower-casing is a BUSINESS RULE, not a formatting nicety: without it
 * `A@b.com` and `a@b.com` are two distinct unique keys, both can register, and
 * the same human ends up with two accounts. Note it is `toLowerCase()` only and
 * NOT `normalize('NFKC')` — the backend does not perform Unicode normalisation,
 * so visually identical addresses written with different Unicode forms can still
 * register twice. Preserved as-is rather than silently changed.
 *
 * An empty value returns `null` (not "no duplicate") so the caller can tell
 * "nothing to check" from "checked, and it is free"; required-field validation
 * is a different concern and happens elsewhere.
 *
 * `excludeUserId` is what makes this usable from an UPDATE as well as a create:
 * without it, saving an unchanged profile would collide with the user's own row.
 */
async function checkDuplicateEmail(email, excludeUserId = null) {
  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed) return null;
  const query = { email: trimmed };
  if (excludeUserId) query._id = { $ne: excludeUserId };
  // `.lean()` because the caller only needs to know THAT a duplicate exists and
  // (in the aggregate path) read a few scalar fields — hydrating a full Mongoose
  // document with its `roles` sub-document and virtuals is wasted work.
  const existing = await User.findOne(query).lean();
  return existing || null;
}

/**
 * The Student ID duplicate check.
 *
 * Unlike `email` this is a CASE-SENSITIVE exact match: the institutional ID is
 * stored as typed, and the model has no `lowercase` on `uniID`. Trimming only.
 */
async function checkDuplicateUniID(uniID, excludeUserId = null) {
  const trimmed = (uniID || '').trim();
  if (!trimmed) return null;
  const query = { uniID: trimmed };
  if (excludeUserId) query._id = { $ne: excludeUserId };
  const existing = await User.findOne(query).lean();
  return existing || null;
}

/**
 * Certificate-number duplicate check. Same contract as the other two; the
 * `excludeCertId` argument excludes by the certificate document's `_id` (which
 * is what an update path has available), NOT by `certificateId` — note the
 * asymmetry with the argument name, which would otherwise suggest otherwise.
 */
async function checkDuplicateCertificateId(
  certificateId,
  excludeCertId = null,
) {
  const trimmed = (certificateId || '').trim();
  if (!trimmed) return null;
  const query = { certificateId: trimmed };
  if (excludeCertId) query._id = { $ne: excludeCertId };
  const existing = await Certificate.findOne(query).lean();
  return existing || null;
}

/**
 * 409 (Conflict) rather than 400 (Bad Request): the request was well-formed,
 * it just collides with existing data. The caller-supplied `fieldLabel` lets an
 * admin path say "Uni ID" while the public registration path says "Email"
 * without duplicating the sentence.
 */
async function assertEmailUnique(email, excludeUserId, fieldLabel = 'Email') {
  const existing = await checkDuplicateEmail(email, excludeUserId);
  if (existing) {
    throw new ApiError(409, 'Validation failed', [
      {
        field: 'email',
        message: `${fieldLabel} address is already registered. Please use a different ${fieldLabel.toLowerCase()}.`,
      },
    ]);
  }
}

/**
 * The message is FIXED rather than interpolated, and deliberately tells the user
 * to contact an administrator: a Student ID is issued by the institution, so a
 * duplicate usually means a genuine data-entry problem and the user cannot
 * resolve it themselves by typing something different.
 */
async function assertUniIDUnique(uniID, excludeUserId) {
  const existing = await checkDuplicateUniID(uniID, excludeUserId);
  if (existing) {
    throw new ApiError(409, 'Validation failed', [
      {
        field: 'uniID',
        message:
          'This Student ID is already registered. Please contact an administrator if you believe this is a mistake.',
      },
    ]);
  }
}

/**
 * The certificate number IS interpolated into the message, unlike the two above:
 * it is not a personal identifier, it is the thing the admin is trying to
 * create, so naming it is the useful part of the error.
 */
async function assertCertificateIdUnique(certificateId, excludeCertId) {
  const existing = await checkDuplicateCertificateId(
    certificateId,
    excludeCertId,
  );
  if (existing) {
    throw new ApiError(409, 'Validation failed', [
      {
        field: 'certificateId',
        message: `Certificate ${certificateId.trim()} already exists.`,
      },
    ]);
  }
}

/**
 * Converts a `{ field: message }` map into the `[{ field, message }]` list shape
 * that `ApiError` stores in its (singularly named) `error` property and that
 * the client renders as a form-level error list.
 *
 * `Object.entries` means the ORDER of the errors in the response follows the
 * key insertion order of the object passed in, not alphabetical order. Callers
 * rely on that to control which message is shown first, so the order the object
 * literal is written in is meaningful — do not sort.
 */
function buildFieldErrors(errorsObj) {
  return Object.entries(errorsObj).map(([field, message]) => ({
    field,
    message,
  }));
}

export {
  assertCertificateIdUnique,
  assertEmailUnique,
  assertUniIDUnique,
  buildFieldErrors,
  checkDuplicateCertificateId,
  checkDuplicateEmail,
  checkDuplicateUniID,
};
