import 'server-only';

import { Role } from '@/lib/server/models/role.model';
import { ApiError } from '@/lib/server/errors';
import { ApiResponse } from '@/lib/server/response';

/**
 * Port of `cpccu-server/src/controllers/adminRole.controller.js`.
 *
 * The admin panel's catalogue of CPCCU positions ("President", "Treasurer", …).
 *
 * READ THIS BEFORE ASSUMING A ROLE HERE MATTERS. The `Role` collection is a
 * free-form catalogue of DISPLAY names for club positions. It is NOT the
 * privilege model: authorisation is decided by the `roles.role` enum on the user
 * document (`adminAuth.js`), and creating a `Role` document named "Treasurer"
 * grants nobody anything. The two are deliberately not reconciled — see the
 * docblock on `roleSchema` in `models/role.model.js`.
 *
 * `asyncHandler` is dropped, as in every ported controller: the shim's
 * `res.json()` resolves, and a thrown error propagates into `apiRoute`, which
 * shapes it through the same `toErrorResponse` the Express error handler was
 * ported into. No behaviour changes.
 *
 * Every route behind this file is mounted under
 * `verifyToken` + `requireAdmin` + `authorizeAdminAction` in the Express router.
 */

/**
 * The roles the panel expects to exist, and SEEDS ON EVERY READ.
 *
 * This is a self-healing catalogue rather than a migration: rather than shipping
 * a seed script, the two GET handlers call `seedDefaultRoles()` first, so a fresh
 * deployment — or one whose collection was cleared — always shows the ten
 * baseline positions without anyone having to run anything.
 *
 * Note the consequences that fall out of doing the seeding on a GET: a plain
 * read endpoint performs ten writes, these two endpoints are not `GET`-safe, and
 * the seeding is not transactional. Both are original behaviour and are
 * preserved.
 */
const SEED_ROLES = [
  'President',
  'Vice President',
  'General Secretary',
  'Treasurer',
  'Social Media Manager',
  'Event Organizer',
  'Advisor',
  'Former President',
  'Former Vice President',
  'Alumni',
];

/**
 * Upserts each baseline role, keyed on its SLUG rather than its name.
 *
 * THE SLUG IS THE IDENTITY, and that is deliberate: renaming a role in the panel
 * produces a new slug, and seeding on `slug` means the seed will not resurrect a
 * renamed position or fight with a custom one. `{ name, slug, active: true }` is
 * written unconditionally, so seeding also RE-ACTIVATES a role an admin
 * deliberately switched off — the seed is a baseline, not a preference.
 *
 * THE LOOP IS SEQUENTIAL, and that is preserved rather than parallelised with
 * `Promise.all`. Ten upserts on a tiny collection is cheap, and running them in
 * order keeps the writes deterministic; there is no read in this function that
 * depends on any of them having completed, so nothing here observes the
 * ordering — the cost is ten round trips on a request an admin triggers rarely.
 * The two GET handlers await this BEFORE querying, which is what guarantees the
 * newly seeded roles appear in the response they return.
 */
const seedDefaultRoles = async () => {
  for (const name of SEED_ROLES) {
    // Lower-cased, with each run of whitespace collapsed to a single hyphen, so
    // "Vice President" and "vice  president" are the same catalogue entry.
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    await Role.findOneAndUpdate(
      { slug },
      { name, slug, active: true },
      // `upsert` creates the role on first sight; `new: true` is irrelevant to
      // the caller here (the return value is discarded) and is kept verbatim.
      { upsert: true, new: true },
    );
  }
};

/**
 * Every role in the catalogue, including the switched-off ones — this is the
 * admin's management view, not a picker.
 *
 * Sorted by `name` rather than by insertion or by `active`, so the panel shows a
 * stable alphabetical list.
 */
const getAdminRoles = async (req, res) => {
  await seedDefaultRoles();
  const roles = await Role.find().sort({ name: 1 });
  return res
    .status(200)
    .json(new ApiResponse(200, roles, 'CPCCU roles retrieved'));
};

/**
 * Only the ENABLED roles — the dropdown the member form offers.
 *
 * The distinction from `getAdminRoles` is the business point: `active: false`
 * hides a position from the picker WITHOUT removing it, because members who
 * already hold that position keep it. Deleting the row instead would either
 * strand them with a value no longer in the catalogue, or require a migration.
 */
const getActiveRoles = async (req, res) => {
  await seedDefaultRoles();
  const roles = await Role.find({ active: true }).sort({ name: 1 });
  return res
    .status(200)
    .json(new ApiResponse(200, roles, 'Active CPCCU roles retrieved'));
};

/**
 * Adds a position to the catalogue.
 *
 * ====================== PRESERVED DEFECT: THE ESCAPE IS A NO-OP ======================
 * The character class `[.*+?^${}()|[\]\\]` is correct, but the REPLACEMENT is
 * written `'\$&'` — ONE backslash in the source text. JavaScript has no `\$`
 * escape, so the backslash is dropped and the replacement is the bare string
 * `$&`, i.e. the matched metacharacter with NOTHING in front of it. Every
 * metacharacter is therefore still a metacharacter in the finished pattern.
 * (Compare `escapeRegex` in `adminContent.controller.js`, which gets this right
 * with `'\\$&'` and really does escape. Two copies of the same idea, one correct
 * and one not; do NOT "align" them as part of a port.)
 *
 * The observable consequences, all preserved:
 *  - a role named `Vice (President)` yields the pattern `^vice-(president)$`, in
 *    which `(president)` is a GROUP, so it also matches an existing
 *    `vice-president` and reports a spurious 409;
 *  - a role named `.*` yields `^.*$`, which matches any existing slug, so the
 *    endpoint reports "already exists" for essentially any name;
 *  - the direction of travel is match-BROADENING, never a false negative and
 *    never code execution: the value is embedded in a REGEX, and the `Role.create`
 *    below stores the unescaped slug regardless.
 * The unique index on `slug` still protects the write itself; this check is a UX
 * nicety that happens to be wrong in the presence of punctuation.
 *
 * The `i` flag is, in practice, a SAFETY NET for rows written BEFORE the
 * schema gained `lowercase: true` on `slug`: today both the stored value and the
 * derived one are already lower-cased, so the unique index would reject a
 * differently-cased duplicate on its own — and the index remains the
 * race-condition backstop for two concurrent creates. The difference the 409 buys
 * is the ERROR: a field-level message the panel can put next to the input, rather
 * than an `E11000` -> 500.
 */
const createAdminRole = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Role name is required');
  }
  const trimmed = name.trim();
  const slug = trimmed.toLowerCase().replace(/\s+/g, '-');
  const existing = await Role.findOne({
    slug: {
      $regex: new RegExp(
        '^' + slug.replace(/[.*+?^${}()|[\]\\]/g, '\$&') + '$',
        'i',
      ),
    },
  });
  if (existing) {
    throw new ApiError(409, 'Role "' + trimmed + '" already exists');
  }
  const role = await Role.create({ name: trimmed, slug, active: true });
  return res
    .status(201)
    .json(new ApiResponse(201, role, 'Role created successfully'));
};

/**
 * Renames a role, switches it on/off, or both in one call.
 *
 * RENAMING RECOMPUTES THE SLUG from the new name rather than keeping the old one,
 * so the slug is a derived value of the name and the two can never disagree. The
 * consequence — and the reason this is called out — is that a rename can produce
 * a slug that ALREADY EXISTS: this handler performs NO duplicate check, unlike
 * `createAdminRole`. The unique index on `slug` is then the only thing standing
 * between a rename and a duplicate, so the failure surfaces as the index's
 * `E11000` rather than as a 409 with a field message. Preserved, not fixed —
 * narrowing the two paths to agree is a behaviour change.
 *
 * `{ new: true }` here versus `returnDocument: 'after'` in `admin.controller.js`
 * is an INCONSISTENCY IN THE ORIGINAL, not a port artifact: both are accepted by
 * the installed Mongoose major and both return the post-update document. Left as
 * found so the two files still line up with their sources.
 */
const updateAdminRole = async (req, res) => {
  const { id } = req.params;
  const { name, active } = req.body;
  const update = {};
  if (name !== undefined) {
    // `name.trim()` is called on the raw value, so a non-string `name` (a number
    // or `null` sent as JSON) throws a `TypeError` and becomes a 500 rather than
    // the 400 below. The only guard is the emptiness check that FOLLOWS the
    // trim, so it can never catch a wrong type. Preserved from the original.
    const trimmed = name.trim();
    if (!trimmed) throw new ApiError(400, 'Role name cannot be empty');
    update.name = trimmed;
    update.slug = trimmed.toLowerCase().replace(/\s+/g, '-');
  }
  if (active !== undefined) {
    // `Boolean(active)` COERCES rather than validating: the string `"false"` and
    // the number `0` both become `true`. A panel that sends a checkbox as a
    // string therefore cannot switch a role off through this endpoint. Preserved.
    update.active = Boolean(active);
  }
  if (Object.keys(update).length === 0) {
    throw new ApiError(400, 'No role changes provided');
  }
  const role = await Role.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true },
  );
  if (!role) {
    throw new ApiError(404, 'Role not found');
  }
  return res
    .status(200)
    .json(new ApiResponse(200, role, 'Role updated successfully'));
};

/**
 * Flips a role's `active` flag.
 *
 * READ-THEN-WRITE, NOT AN ATOMIC UPDATE. `findById` followed by an in-memory
 * `role.active = !role.active` and `save()` means two concurrent toggles both read
 * the same starting value, both write the SAME opposite value, and one of the two
 * intended flips is lost. The atomic form would be a single `findByIdAndUpdate`
 * with `$set: { active: { $not: ... } }` or a pipeline update. Preserved verbatim:
 * the panel issues one toggle at a time per role, and changing the write means
 * changing what the response body carries.
 *
 * `findById` is also the only validation of `id` here: a malformed id throws a
 * Mongoose `CastError`, which becomes a 500 rather than the 404 a missing role
 * produces. Same in the original; preserved.
 *
 * The response MESSAGE reports the resulting state, so the panel can confirm
 * which way the toggle went without re-deriving it.
 */
const toggleAdminRole = async (req, res) => {
  const { id } = req.params;
  const role = await Role.findById(id);
  if (!role) {
    throw new ApiError(404, 'Role not found');
  }
  role.active = !role.active;
  await role.save();
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        role,
        (role.active ? 'enabled' : 'disabled') + ' successfully',
      ),
    );
};

export {
  createAdminRole,
  getActiveRoles,
  getAdminRoles,
  toggleAdminRole,
  updateAdminRole,
};
