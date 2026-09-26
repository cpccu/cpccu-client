import 'server-only';

import { Certificate } from '@/lib/server/models/certificate.model';
import { Post } from '@/lib/server/models/post.model';
import { User } from '@/lib/server/models/user.model';
import {
  ContactMessage,
  DeveloperProfile,
  Event,
} from '@/lib/server/models/adminContent.model';
import { PUBLIC_ITEM } from '@/lib/server/constants';
import { ApiError } from '@/lib/server/errors';
import { ApiResponse } from '@/lib/server/response';
import { assertEmailUnique } from '@/lib/server/validation-helper';

/**
 * Port of `cpccu-server/src/controllers/admin.controller.js`.
 *
 * The five member-management handlers behind the admin panel's Overview and
 * Members pages. Everything here uses the `ApiResponse` envelope (envelope #1 of
 * the four documented in `response.js`), and every failure is an `ApiError`
 * (envelope #2) — nothing in this file invents its own body shape.
 *
 * `asyncHandler` IS DROPPED, as it is in every ported controller. In Express it
 * existed only to forward a rejected promise to `next(error)`; here the shim's
 * `res.json()` returns a resolved promise and an unhandled `throw` propagates out
 * of the handler into `apiRoute`, which shapes it through the same
 * `toErrorResponse` the Express error handler was ported into. Wrapping these
 * handlers in an identity function would change nothing observable.
 *
 * SECURITY CONTEXT. Every route in this controller is mounted behind
 * `verifyToken` + `requireAdmin` + `authorizeAdminAction` (see
 * `cpccu-server/src/routes/admin.route.js:40`), so by the time a handler runs
 * there is an authenticated principal whose `roles.role` is one of
 * admin / moderator / mentor. What is NOT guaranteed by that chain is any
 * per-member authorisation, which is why the two self-targeting guards below are
 * part of the business rules rather than defence in depth.
 */

/**
 * THE ROLES AN ADMIN MAY GRANT, and deliberately NOT the same list as the
 * panel-access allowlist in `adminAuth.js` (admin / moderator / mentor).
 *
 * `member` is grantable but grants no panel access; `admin` is grantable and does.
 * The two lists being different is a business rule, not an oversight — see the
 * long note in `adminAuth.js` on the same asymmetry. Keep them in sync when the
 * enum in `models/user.model.js` changes, and change BOTH deliberately.
 *
 * NOTE this is a third copy of the idea: the enum itself lives in
 * `roleSchema` in `models/user.model.js`. As in the original, it is a literal
 * here rather than an import, so the allowlist survives a schema that has been
 * widened by a migration.
 */
const adminRoles = ['admin', 'moderator', 'mentor', 'member'];

/**
 * The admin Overview dashboard: ten independent counters in ONE round trip.
 *
 * `Promise.all` rather than ten sequential `await`s is what makes this a single
 * latency instead of ten serialised ones; there is no cross-counter dependency to
 * satisfy, so the only cost of the concurrency is ten simultaneous short queries
 * against a collection the admin panel is already querying constantly.
 *
 * The definitions are the dashboard's semantics, not incidental:
 *  - `verifiedMembers` / `pendingMembers` split on `isValid`, which is the same
 *    flag `auth.js` uses to reject a login, so "verified" here means exactly
 *    "can currently authenticate".
 *  - `adminMembers` counts `'roles.role': 'admin'` and nothing else — a
 *    moderator or mentor is an admin-panel user but is not an administrator, and
 *    the dashboard labels this tile "Admins".
 *  - `activeEvents` is the set of events that are `upcoming` OR `ongoing`; a
 *    `past` event is not counted. Note this is the only `eventDate`-independent
 *    notion of "active" in the API — an event whose date has passed but whose
 *    status was never moved to `past` is still counted here.
 *  - `pendingProfiles` / `approvedProfiles` are the developer-profile moderation
 *    queue, and `unreadMessages` is the contact-form inbox.
 */
const getAdminOverview = async (req, res) => {
  const [
    totalMembers,
    verifiedMembers,
    pendingMembers,
    adminMembers,
    totalPosts,
    totalCertificates,
    activeEvents,
    pendingProfiles,
    approvedProfiles,
    unreadMessages,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isValid: true }),
    User.countDocuments({ isValid: false }),
    User.countDocuments({ 'roles.role': 'admin' }),
    Post.countDocuments(),
    Certificate.countDocuments(),
    Event.countDocuments({ status: { $in: ['upcoming', 'ongoing'] } }),
    DeveloperProfile.countDocuments({ status: 'pending' }),
    DeveloperProfile.countDocuments({ status: 'approved' }),
    ContactMessage.countDocuments({ status: 'unread' }),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalMembers,
        verifiedMembers,
        pendingMembers,
        adminMembers,
        totalPosts,
        totalCertificates,
        activeEvents,
        pendingProfiles,
        approvedProfiles,
        unreadMessages,
      },
      'Admin overview',
    ),
  );
};

/**
 * Every member, newest first, for the admin Members table.
 *
 * `PUBLIC_ITEM` is the projection that keeps `password`, `refreshTokens` and the
 * OTP documents out of an admin-facing response. It is the same projection the
 * public member list uses, and the same one `updateAdminMember` returns — so an
 * admin can never read a member's password hash through any of these three
 * endpoints, even though the admin panel holds far more privilege than the
 * public one. See the security note on `PUBLIC_ITEM` in `constants.js` for what
 * the projection still exposes (uniID, roles, and the two Cloudinary public ids).
 */
const getAdminMembers = async (req, res) => {
  const members = await User.find({}, PUBLIC_ITEM).sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, members, 'Admin members data'));
};

/**
 * Edit one member from the admin panel.
 *
 * The payload is assembled FIELD BY FIELD rather than spreading `req.body`,
 * because this is an endpoint that writes `isValid` (the ban flag) and `roles`
 * (the privilege level). A spread would let a caller set any other field on the
 * user schema — `refreshTokens`, `googleID`, `password` — through an endpoint
 * whose UI has no such control. The allowlist below is the whole reason the body
 * is not forwarded.
 *
 * Two deliberate asymmetries inside it, both business rules:
 *  - `isValid` is applied only on a `typeof === 'boolean'` test, so that a
 *    client sending the string `"false"` (or omitting the field, as the panel
 *    does for a partially filled form) cannot accidentally UNVERIFY a member. A
 *    truthiness test would let `'false'` through and ban somebody.
 *  - `phone`, `section`, `skills`, `bio`, `github`, `linkedin`, `portfolio`,
 *    `department` and `batch` use `!== undefined`, i.e. they can be CLEARED with
 *    an empty string. `fullName` and `email` use `?.trim()` truthiness instead,
 *    so an empty value for those is treated as "not supplied" and leaves the
 *    existing value alone — they are the identity fields, and blanking them is
 *    never a legitimate edit.
 */
const updateAdminMember = async (req, res) => {
  const { id } = req.params;
  const {
    fullName,
    email,
    isValid,
    phone,
    role,
    position,
    positionName,
    section,
    skills,
    bio,
    github,
    linkedin,
    portfolio,
    department,
    batch,
  } = req.body;

  if (!id) {
    throw new ApiError(400, 'Member ID is required');
  }

  const payload = {};

  if (typeof isValid === 'boolean') {
    payload.isValid = isValid;
  }

  if (fullName?.trim()) payload.fullName = fullName.trim();
  if (email?.trim()) payload.email = email.trim();
  if (phone !== undefined) payload.phone = phone;
  if (section !== undefined) payload.section = section;
  if (Array.isArray(skills)) payload.skills = skills;
  if (bio !== undefined) payload.bio = bio;
  if (github !== undefined) payload.github = github;
  if (linkedin !== undefined) payload.linkedin = linkedin;
  if (portfolio !== undefined) payload.portfolio = portfolio;
  if (department !== undefined) payload.department = department;
  if (batch !== undefined) payload.batch = batch;

  // A `role` REPLACES THE WHOLE `roles` SUB-DOCUMENT rather than merging into
  // it. That is exhaustive today — `roleSchema` in `models/user.model.js`
  // declares exactly `role`, `position` and `positionName` and is `_id: false` —
  // so nothing is lost, but a fourth field added to that sub-schema later would
  // be silently dropped by this line.
  if (role) {
    if (!adminRoles.includes(role)) {
      throw new ApiError(400, 'Invalid member role');
    }

    payload.roles = {
      role,
      // `Number.isFinite(Number(position)) ? Number(position) : 0` — a
      // non-numeric or absent position becomes 0. `position` is REQUIRED by the
      // schema, so it can never be left `undefined`; 0 means "no ranking", which
      // is the correct default for a member who was just granted a role.
      position: Number.isFinite(Number(position)) ? Number(position) : 0,
      // Falls back to the ROLE NAME when no display name was given, so a member
      // rendered by `positionName` shows "Moderator" rather than a blank chip.
      positionName: positionName?.trim() || role,
    };
  }

  // An empty payload would still be a valid `$set`, so without this the endpoint
  // would answer 200 for a request that changed nothing — the panel's "Save"
  // would appear to succeed on a no-op. 400 is the honest answer.
  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, 'No member changes were provided');
  }

  // SELF-REVOCATION GUARD — a business rule, not a security control, and the
  // distinction matters. The admin chain (`requireAdmin` +
  // `authorizeAdminAction`) authorises the ACTION, not the TARGET, so a
  // moderator or admin could otherwise strip their own `admin` role or set
  // their own `isValid` to false and lock the panel out with nobody able to
  // undo it. It covers the two ways this handler can demote the caller:
  // un-verifying themselves, or changing their own role to a non-admin one.
  //
  // Note it is NOT a full last-admin guard: it does not check that some OTHER
  // admin exists, so two admins demoting each other in sequence can still leave
  // the panel with no administrator. Preserved as-is; tightening it is a product
  // decision, not a porting one.
  if (
    id === req.user._id.toString() &&
    (payload.isValid === false ||
      (payload.roles && payload.roles.role !== 'admin'))
  ) {
    throw new ApiError(400, 'You cannot revoke your own admin access');
  }

  // Only asserted when an email was actually supplied, and `id` is passed as the
  // exclusion so that saving a member WITHOUT changing their email does not
  // collide with the member's own row — the single most likely way this check
  // could turn every save into a 409.
  if (payload.email) {
    await assertEmailUnique(payload.email, id);
  }

  const member = await User.findByIdAndUpdate(
    id,
    { $set: payload },
    // `returnDocument: 'after'` is the Mongoose 8+ spelling and returns the
    // POST-update document. It is the newer, driver-level name for what older
    // Mongoose called `{ new: true }`; both appear in this codebase, and the
    // installed Mongoose major (9) accepts this one. Preserved verbatim from the
    // Express source rather than "modernised" to match the blog posts, because
    // changing it would change which document the response body carries.
    //
    // `runValidators: true` re-runs the schema validators on this `$set`. It is
    // load-bearing precisely BECAUSE the payload is hand-assembled: it is what
    // stops a role enum violation or an oversized `bio` from reaching the
    // collection through an update (updates otherwise bypass every schema
    // constraint).
    { returnDocument: 'after', runValidators: true },
  ).select(PUBLIC_ITEM);

  if (!member) {
    throw new ApiError(404, 'Member not found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, member, 'Member updated successfully'));
};

/**
 * Create a member directly from the admin panel — the "add member" path, which
 * BYPASSES registration.
 *
 * Two consequences of that bypass are worth stating:
 *  - the password is accepted verbatim and goes through the model's `pre('save')`
 *    hook (so it is bcrypt-hashed, exactly as on the registration path), but it
 *    does NOT go through `validatePasswordStrength` in `auth.controller.js`, so
 *    the 8+ character policy with character-class rules does not apply here. An
 *    admin can create a member with a one-character password.
 *  - `isValid` DEFAULTS TO `true` here, whereas the public registration path
 *    creates an account with `isValid: false` and requires an OTP verification.
 *    An admin-created member is therefore immediately able to log in.
 * Both are original behaviour, preserved.
 *
 * `role = 'member'` is the default, so omitting the field creates the LOWEST
 * privilege an admin can grant rather than anything elevated.
 */
const createAdminMember = async (req, res) => {
  const {
    fullName,
    email,
    password,
    batch,
    uniID,
    phone,
    role = 'member',
    section,
    skills = [],
    isValid = true,
  } = req.body;

  // Email is lower-cased because the uniqueness rule is case-insensitive (see
  // `assertEmailUnique`'s docblock); a Student ID is only trimmed, because the
  // institutional ID is stored as typed.
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedUniID = (uniID || '').trim();

  if (
    !fullName?.trim() ||
    !trimmedEmail ||
    !password ||
    !batch ||
    !trimmedUniID
  ) {
    throw new ApiError(
      400,
      'Name, email, password, batch, and university ID are required',
    );
  }

  // Digits only. Anchored at both ends by `^`/`$`, so a value containing letters
  // or spaces is rejected rather than partially matched.
  if (!/^\d+$/.test(trimmedUniID)) {
    throw new ApiError(400, 'University ID must be digits only.', [
      {
        field: 'uniID',
        message:
          'University ID must contain digits only (no symbols or spaces).',
      },
    ]);
  }

  if (!adminRoles.includes(role)) {
    throw new ApiError(400, 'Invalid member role');
  }

  // BOTH duplicate lookups in one round trip. The `trimmedX ? ... : resolve(null)`
  // guards are dead in practice — both values are already known non-empty by the
  // required-field check above — and are preserved from the original.
  const duplicateChecks = await Promise.all([
    trimmedEmail
      ? User.findOne({ email: trimmedEmail }).lean()
      : Promise.resolve(null),
    trimmedUniID
      ? User.findOne({ uniID: trimmedUniID }).lean()
      : Promise.resolve(null),
  ]);

  const existingEmail = duplicateChecks[0];
  const existingUniID = duplicateChecks[1];

  // The two conflicts are AGGREGATED into a single 409 rather than reported one
  // at a time, so a form that has a duplicate email AND a duplicate Student ID
  // comes back with both messages and the admin fixes both in one pass. 409
  // (Conflict) rather than 400 because the request was well-formed — it just
  // collides with existing data.
  const fieldErrors = [];
  if (existingEmail) {
    fieldErrors.push({
      field: 'email',
      message:
        'This email address is already registered. Please use a different email.',
    });
  }
  if (existingUniID) {
    fieldErrors.push({
      field: 'uniID',
      message:
        'This Student ID is already registered. Please contact an administrator if you believe this is a mistake.',
    });
  }
  if (fieldErrors.length > 0) {
    throw new ApiError(409, 'Validation failed', fieldErrors);
  }

  const createdMember = await User.create({
    fullName: fullName.trim(),
    email: trimmedEmail,
    password,
    batch,
    uniID: trimmedUniID,
    phone,
    section,
    skills: Array.isArray(skills) ? skills : [],
    isValid,
    // `position: 0` and `positionName: role` mirror the schema default: a role
    // grant with no ranking shows the role name as its display label.
    roles: { role, position: 0, positionName: role },
  });

  // Re-read through `PUBLIC_ITEM` rather than returning `createdMember` directly,
  // so the response is projected identically to the one `getAdminMembers` and
  // `updateAdminMember` return and cannot echo anything the projection excludes.
  const member = await User.findById(createdMember._id).select(PUBLIC_ITEM);

  return res.status(201).json(new ApiResponse(201, member, 'Member created'));
};

/**
 * Remove a member outright.
 *
 * RELATED DOCUMENTS ARE NOT CASCADED. The member's posts, projects, comments and
 * developer profile are left behind, and `PUBLIC_ITEM` exposes `uniID` and
 * `roles` on the records that do remain. This is the original behaviour; a real
 * cleanup is a product decision (delete vs anonymise) and is deliberately not
 * smuggled into a port.
 *
 * 200 with a `null` payload rather than 204: the `ApiResponse` envelope requires
 * a body, and the panel reads `message` off it.
 */
const deleteAdminMember = async (req, res) => {
  // Same self-targeting rule as the update path, with a different message. Two
  // different messages for the same rule is original behaviour; the 400 (rather
  // than 403) is preserved too, and is consistent with the update path's.
  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot remove your own admin account here');
  }

  const member = await User.findByIdAndDelete(req.params.id);

  if (!member) {
    throw new ApiError(404, 'Member not found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'Member removed successfully'));
};

export {
  createAdminMember,
  deleteAdminMember,
  getAdminMembers,
  getAdminOverview,
  updateAdminMember,
};
