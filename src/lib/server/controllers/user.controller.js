import 'server-only';

import { DeveloperProfile } from '@/lib/server/models/adminContent.model';
import { User } from '@/lib/server/models/user.model';
import { ApiError } from '@/lib/server/errors';
import { ApiResponse } from '@/lib/server/response';
import {
  destroyCloudinaryImage,
  parsePublicIdFromCloudinaryUrl,
  uploadOnCloudinary,
} from '@/lib/server/cloudinary';
import { isValidIdentity } from '@/lib/server/isValidIdentity';
import {
  assertEmailUnique,
  assertUniIDUnique,
} from '@/lib/server/validation-helper';
import { PUBLIC_ITEM, PUBLIC_MEMBER_ITEM, PUBLIC_PROFILE_ITEM } from '@/lib/server/constants';

/**
 * Port of `cpccu-server/src/controllers/user.controller.js`.
 *
 * ============================ DIVERGENCE 3 OF 3 ============================
 * The two imports the original carried and NEVER USED are dropped:
 *   - `mongoose` (line 3 of the source) — nothing in this file references the
 *     namespace; every query goes through a model's static method. Keeping it
 *     would drag a Node-gyp-heavy package into the module graph of the
 *     profile endpoints for no reason.
 *   - `jsonwebtoken` (line 11 of the source) — `changePassword` deliberately does
 *     NOT re-issue tokens and nothing else in the file decodes a JWT; the
 *     authenticated identity comes from `req.user`, which `auth.js` already
 *     verified. A JWT helper sitting next to a password-change handler is an
 *     invitation to "helpfully" start minting tokens here.
 * Neither removal changes behaviour; both are omissions, not edits.
 *
 * The remaining real divergence is `req.file.path` -> `req.file.buffer` in
 * `uploadORchangeIMG`, documented at that call site.
 */

// 3 characters is the floor because the title renders as a heading on the
// public developer page, where a 1–2 character string is indistinguishable from
// a placeholder; 100 is the ceiling because the same heading is stored in a
// single Mongo string field and is rendered un-truncated in the admin list.
const JOB_PIPELINE_TITLE_MIN_LENGTH = 3;
const JOB_PIPELINE_TITLE_MAX_LENGTH = 100;

const validateJobPipelineTitle = (title) => {
  if (typeof title !== 'string') {
    throw new ApiError(400, 'Professional title must be a string');
  }

  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw new ApiError(400, 'Professional title is required');
  }

  if (trimmedTitle.length < JOB_PIPELINE_TITLE_MIN_LENGTH) {
    throw new ApiError(400, 'Professional title must be at least 3 characters');
  }

  if (trimmedTitle.length > JOB_PIPELINE_TITLE_MAX_LENGTH) {
    throw new ApiError(
      400,
      'Professional title must be 100 characters or fewer',
    );
  }

  return trimmedTitle;
};

/**
 * Every submission starts in `pending`, and `submittedAt` is stamped on EVERY
 * request rather than only on the first — the admin queue sorts by it, so a
 * member who re-submits after a rejection moves back to the top of the queue.
 * That is the intended behaviour and is why this is an upsert payload rather
 * than a `$setOnInsert`.
 */
const buildDeveloperProfilePayload = (user, title) => ({
  userId: user._id,
  title,
  status: 'pending',
  submittedAt: new Date(),
});

/**
 * Merges the denormalised job-pipeline fields onto the user document.
 *
 * The values are read from the PROFILE when one exists and fall back to the
 * user document, then to `'hidden'`. `'hidden'` — not `'unlisted'`, not
 * `null` — is the fail-closed default: a user with no profile at all is not
 * published, which is the only safe default for something the site lists
 * publicly.
 */
const toPublicJobPipelineUser = (user, profile = null) => {
  const userObject = user?.toObject ? user.toObject() : { ...user };
  const status = profile?.status || userObject.jobPipelineStatus || 'hidden';
  const title = profile?.title || userObject.jobPipelineTitle || '';
  const rejectionReason =
    profile?.rejectionReason || userObject.jobPipelineRejectionReason || '';

  return {
    ...userObject,
    jobPipelineStatus: status,
    jobPipelineTitle: title,
    jobPipelineRejectionReason: rejectionReason,
    developerProfile: profile
      ? {
          id: profile._id?.toString?.() || profile.id,
          status,
          title,
          rejectionReason,
        }
      : null,
  };
};

/**
 * Reconciles the DENORMALISED job-pipeline fields on the user document with the
 * authoritative `DeveloperProfile`, writing back when they disagree.
 *
 * WHY THE WRITE-BACK. `DeveloperProfile` is the source of truth and the user
 * document carries a copy so the public members list can filter and render
 * without a join. Nothing in the admin path updates that copy, so it is
 * refreshed lazily on read. The write is CONDITIONAL (`if` on the three
 * comparisons) rather than unconditional: this runs on every `getUserInfo`, and
 * writing a no-op `$set` on every profile view would dirty the user document
 * and re-fire any `updatedAt` consumers for no reason.
 *
 * The legacy migration block below is a ONE-TIME data repair for profiles
 * created before the schema gained a `userId` back-reference: it finds them by
 * `email`, back-fills `userId` and `submittedAt`, and `$unset`s the duplicated
 * identity fields so there is a single copy. It only runs when no profile was
 * found by `userId`, so it is a fallback, not a per-request cost.
 */
const resolveJobPipelineStatus = async (user) => {
  if (!user?._id) return user;

  let profile = await DeveloperProfile.findOne({ userId: user._id }).sort({
    submittedAt: -1,
    updatedAt: -1,
  });

  if (!profile && user.email) {
    const legacyProfile = await DeveloperProfile.collection.findOne({
      email: user.email,
    });

    if (legacyProfile) {
      await DeveloperProfile.collection.updateOne(
        { _id: legacyProfile._id },
        {
          $set: {
            userId: user._id,
            submittedAt: legacyProfile.submittedAt || legacyProfile.createdAt,
          },
          // Every one of these fields is REMOVED, `email` included, because the
          // whole point of the back-fill is that the user's identity now lives on
          // the `user` document reached through `userId`, and keeping a second
          // copy here is what lets the two drift apart. Note the `user.email`
          // read in the `if` condition above happens BEFORE this write, so
          // unsetting it does not break the fallback that found it. The
          // subsequent `findById` re-reads by `_id`, not by `email`, which is
          // why it still resolves.
          $unset: {
            name: '',
            email: '',
            phone: '',
            photoUrl: '',
            githubUrl: '',
            linkedinUrl: '',
            portfolioUrl: '',
            skills: '',
            memberSince: '',
            department: '',
          },
        },
      );
      profile = await DeveloperProfile.findById(legacyProfile._id);
    }
  }

  const nextStatus = profile?.status || 'hidden';
  const nextTitle = profile?.title || '';
  const nextRejectionReason = profile?.rejectionReason || '';

  if (
    user.jobPipelineStatus !== nextStatus ||
    user.jobPipelineTitle !== nextTitle ||
    user.jobPipelineRejectionReason !== nextRejectionReason
  ) {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          jobPipelineStatus: nextStatus,
          jobPipelineTitle: nextTitle,
          jobPipelineRejectionReason: nextRejectionReason,
        },
      },
    );
  }

  return user;
};

const getUserInfo = async (req, res) => {
  // `req.user.id`, NOT `req.user._id`. That looks like a typo and is not: the
  // Mongoose default `id` VIRTUAL stringifies `_id`, and the user schema does not
  // disable it, so both spellings resolve to the same value. Left verbatim so
  // the port stays diffable against the original; verified, not a defect.
  const user = await resolveJobPipelineStatus(
    await User.findById(req.user.id).select(PUBLIC_ITEM),
  );
  return res
    .status(200)
    .json(new ApiResponse(200, user, 'User data get successfully'));
};

const getUserInfoById = async (req, res) => {
  const { id } = req.params;
  // `'undefined'` is checked as a literal because the frontend once interpolated
  // a missing id into the URL, producing the literal path segment
  // `/user/undefined`. Treating it as "no id" gives a 400 with a useful message
  // instead of a query for a document that cannot exist.
  if (!id || id === 'undefined') {
    throw new ApiError(400, 'Invalid user ID');
  }
  // PROJECTION. `PUBLIC_PROFILE_ITEM`, NOT `PUBLIC_ITEM` and NOT
  // `PUBLIC_MEMBER_ITEM`. This route is `public: true`, so whatever is projected
  // here is served to an anonymous caller. `PUBLIC_ITEM` would hand the entire
  // membership's email addresses, phone numbers, institutional Student IDs and
  // `roles` (the field `adminAuth.js` authorises the whole admin panel on) to
  // whoever asks — the exact H1 exposure.
  //
  // `PUBLIC_PROFILE_ITEM` and not `PUBLIC_MEMBER_ITEM` because this is the
  // PROFILE PAGE's data, not the directory's. The full public profile renders
  // `coverImage` (`ProfileID.jsx:11-12`), the whole Skills section
  // (`SkillsSection.jsx:10,26` via `Profile.jsx:782`) and the "Member since"
  // row (`ProfileHero.jsx:93` via `Profile.jsx:763`, from `createdAt`), none of
  // which a member card displays; projecting the narrower directory string here
  // made those disappear without any error. `createdAt` is the account-creation
  // timestamp, so it is not user-supplied and discloses no capability — the
  // per-field reasoning is in that constant's docblock. It is still an
  // allow-list, and it still excludes
  // `email`/`phone`/`uniID`/`isValid`/the two Cloudinary `*PublicId` write
  // primitives — and it excludes `roles.positionName` too, which LOOKS like a
  // harmless display label but is written as a copy of the authorising `role`
  // enum by every writer in this codebase (see `PUBLIC_PROFILE_ITEM`'s
  // docblock). Every read that is NOT anonymous (own profile, profile update,
  // avatar upload, admin) keeps `PUBLIC_ITEM`. The allow-list and the per-field
  // reasoning live in `constants.js`; read `PUBLIC_PROFILE_ITEM`'s docblock
  // before changing this line.
  //
  // A 24-hex-character value is treated as an ObjectId; anything else is looked
  // up as a Student ID. This is what lets the public profile page work with
  // either `/user/<objectId>` or `/user/<uniID>` on the same route.
  //
  // `uniID` IS STILL A VALID LOOKUP KEY even though it is no longer projected.
  // The branch is preserved here because the client links to
  // `/profile/${Data?.uniID || Data?._id}` (`AboutCard.jsx:40`), so removing it
  // would 404 every Student-ID profile URL already in the wild — including
  // bookmarks and links shared outside this site. See the tradeoff note in the
  // report: the branch is now an IDENTIFIER ORACLE (a 404 vs a 200 confirms
  // whether a Student ID is registered) but no longer a DISCLOSURE (nothing
  // sensitive is returned, and the identifier had to be guessed). Fixing that
  // properly needs the client repointed at `_id` and an explicit decision.
  //
  // NOTE the deliberate ASYMMETRY with `memberHandler`: this route does NOT
  // filter on `isValid`. A single-member profile lookup is a shareable link, and
  // refusing to render a profile for a member who has not yet clicked their OTP
  // link would break a link that was shared before they verified — whereas the
  // directory is a bulk harvest surface where unverified rows are pure spam
  // surface. Both decisions are recorded in `constants.js`.
  const user = isValidIdentity(id)
    ? await User.findById(id).select(PUBLIC_PROFILE_ITEM)
    : await User.findOne({ uniID: id }).select(PUBLIC_PROFILE_ITEM);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return res
    .status(200)
    .json(new ApiResponse(200, user, 'User data get successfully'));
};

//update user information
const updateUserInfo = async (req, res) => {
  // Extract fields from request body
  // Note: We accept both 'studentId' and 'uniID' for maximum compatibility
  const {
    fullName,
    batch,
    studentId,
    uniID,
    skills,
    phone,
    github,
    linkedin,
    portfolio,
    department,
    section,
    avatar,
    email,
    bio,
  } = req.body;

  const trimmedEmail = (email || '').trim().toLowerCase();
  const newUniID = (studentId || uniID || '').trim();

  // Uniqueness is asserted only when a value was actually supplied. `excludeUserId`
  // is what stops a user saving an UNCHANGED email from colliding with their own
  // row, which is the single most likely way this check could produce a false
  // 409 on every profile save.
  if (trimmedEmail) {
    await assertEmailUnique(trimmedEmail, req.user._id.toString());
  }
  if (newUniID) {
    await assertUniIDUnique(newUniID, req.user._id.toString());
  }

  // Build the update payload
  // The `!== undefined` tests on `portfolio`, `department` and `bio` are
  // DELIBERATELY different from the truthiness tests used for the other fields:
  // these three are free-text fields a user may legitimately want to CLEAR, and
  // a truthiness test would silently drop the empty string and make clearing
  // impossible. The truthiness fields (`fullName`, `batch`, `phone`, …) are
  // omission-means-no-change fields, where an empty string is more plausibly a
  // client that sent the whole form than an intent to erase.
  const payload = {
    ...(fullName && { fullName }),
    ...(batch && { batch }),
    ...(newUniID && { uniID: newUniID }), // Map studentId to uniID
    ...(skills && { skills }),
    ...(phone && { phone }),
    ...(github && { github }),
    ...(linkedin && { linkedin }),
    ...(portfolio !== undefined && { portfolio }),
    ...(department !== undefined && { department }),
    ...(section && { section }),
    ...(avatar && { avatar }),
    ...(trimmedEmail && { email: trimmedEmail }),
    ...(bio !== undefined && { bio }),
  };

  // Update user information using the ID from the verified token (req.user._id)
  const user = await resolveJobPipelineStatus(
    await User.findByIdAndUpdate(
      req.user._id,
      { $set: payload },
      // `new: true` returns the POST-update document so the response reflects
      // what was saved. `runValidators: true` re-runs the schema validators on
      // this `$set`; without it an update bypasses every schema constraint,
      // which is how invalid emails and oversized strings reach the collection.
      { new: true, runValidators: true },
    ).select(PUBLIC_ITEM),
  );

  if (!user) {
    throw new ApiError(404, 'User not found or update failed.');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Profile updated successfully.'));
};

const requestJobPipelineProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Name and email are REQUIRED because the public developer page renders them
  // as the profile's identity, and a listing with a blank name is worse than no
  // listing. The user can add them through `updateUserInfo` and come back.
  if (!user.email || !user.fullName) {
    throw new ApiError(
      400,
      'Name and email are required before requesting job pipeline visibility.',
    );
  }

  const title = validateJobPipelineTitle(req.body?.title);
  // Upsert, so re-submitting after a rejection updates the SAME profile rather
  // than creating a second one; the admin queue would otherwise show duplicates.
  const profile = await DeveloperProfile.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        ...buildDeveloperProfilePayload(user, title),
      },
    },
    { new: true, upsert: true, runValidators: true },
  );

  // The denormalised copy on the user document is written HERE (not left to the
  // lazy read-reconcile in `resolveJobPipelineStatus`) so the member who just
  // submitted immediately sees `pending` in their own profile response.
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        jobPipelineStatus: 'pending',
        jobPipelineTitle: title,
        jobPipelineRejectionReason: '',
      },
    },
  );

  const publicUser = await User.findById(user._id).select(PUBLIC_ITEM);
  const updatedUser = toPublicJobPipelineUser(publicUser, profile);

  // `profile` and `developerProfile` carry the SAME object under two keys. That
  // duplication is in the original and the frontend reads the shorter key; it is
  // preserved rather than cleaned up so no client branch loses its field.
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: updatedUser,
        profile,
        developerProfile: profile,
        jobPipelineStatus: 'pending',
        jobPipelineTitle: title,
        jobPipelineRejectionReason: '',
      },
      'Job pipeline request submitted for admin review.',
    ),
  );
};

const removeJobPipelineProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Hard delete, not a status change: opting OUT of the public developer page
  // should also remove the pending submission from the admin review queue, and
  // a retained `rejected` profile would still be visible to admins forever.
  const profile = await DeveloperProfile.findOneAndDelete({ userId: user._id });

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        jobPipelineStatus: 'hidden',
        jobPipelineTitle: '',
        jobPipelineRejectionReason: '',
      },
    },
  );

  const publicUser = await User.findById(user._id).select(PUBLIC_ITEM);
  const updatedUser = toPublicJobPipelineUser(publicUser, null);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: updatedUser,
        profile: null,
        developerProfile: null,
        jobPipelineStatus: 'hidden',
        jobPipelineTitle: '',
        jobPipelineRejectionReason: '',
      },
      'Removed from job pipeline.',
    ),
  );
};

//upload or update avatar and coverImage
const uploadORchangeIMG = async (req, res) => {
  const { key } = req.params;

  // ---------------------------------------------------------------------
  // DIVERGENCE (the Vercel filesystem change, already made in Phase 1.5):
  // `req.file.path` -> `req.file.buffer`.
  //
  // The original read a path because multer's `diskStorage` wrote the upload to
  // `./public/temp` and the uploader opened that path. Neither half survives the
  // move to a serverless runtime: the bundle filesystem is read-only, `/tmp` is
  // the only writable location, and an execution lives only for the duration of
  // the request — so a path is not merely inconvenient, it is not addressable.
  // `cloudinary.js` was therefore rewritten in Phase 1.5 to consume BYTES
  // (`upload_stream` + a Node `Readable`, deliberately not a base64 data URI),
  // and the shim supplies those bytes as `req.file.buffer`.
  //
  // `size` carries the client-declared byte length and is what
  // `uploadOnCloudinary`'s own cap check reads, so an oversized file still
  // produces the documented 400 from OUR code rather than an opaque platform
  // `413`.
  // ---------------------------------------------------------------------
  const imageBuffer = req.file?.buffer;

  if (!imageBuffer) {
    throw new ApiError(400, 'Image file is missing');
  }

  // The allow-list is a security control, not a typo check: `key` is a URL
  // segment and becomes a Mongo field name in the `$set` below. Restricting it
  // to two known keys is what stops a caller writing ARBITRARY fields onto its
  // own user document through this endpoint (e.g. `?key=roles`).
  if (!['avatar', 'coverImage'].includes(key)) {
    throw new ApiError(400, 'Invalid image key');
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const existingValue = user[key];
  // The stored public id is preferred over deriving one from the URL because it
  // is exact: `parsePublicIdFromCloudinaryUrl` deliberately returns `null` for
  // anything it cannot prove was created by this app.
  const existingPublicIdKey =
    key === 'avatar' ? 'avatarPublicId' : 'coverImagePublicId';
  const existingPublicId = user[existingPublicIdKey];

  // DELETE-BEFORE-UPLOAD, and the ordering is the point.
  //
  // The previous asset is destroyed BEFORE the replacement is uploaded, so a
  // failed upload leaves the user with NO image rather than two. That is the
  // intentional trade: an empty avatar is a cosmetic gap, whereas keeping the
  // old one would silently retain an image the user asked to replace (and would
  // leak storage, since the destroy never runs on the next save).
  //
  // FAILURE SEMANTICS ARE NON-FATAL BY DESIGN. `destroyCloudinaryImage` swallows
  // its own errors and returns `false` (see its docblock in `cloudinary.js`),
  // and the legacy branch below wraps it in a try/catch that only logs. So a
  // Cloudinary outage on the DELETE leaves an orphaned asset and the upload still
  // proceeds — the user gets their new image and the old one leaks storage. The
  // alternative (failing the request) would let a third-party CDN problem block
  // a profile update, and `destroyCloudinaryImage`'s own contract is that an
  // orphaned asset is preferable to a failed update. The new public id is
  // written below, so a subsequent successful save WILL retry the cleanup of
  // the newer asset; the older orphan is not recoverable from here.
  if (existingPublicId) {
    await destroyCloudinaryImage(existingPublicId);
  } else if (existingValue && typeof existingValue === 'string') {
    const publicId = parsePublicIdFromCloudinaryUrl(existingValue);
    if (publicId) {
      try {
        await destroyCloudinaryImage(publicId);
      } catch (error) {
        console.error(
          `Failed to cleanup legacy ${key} for user ${user._id}:`,
          error,
        );
      }
    }
  }

  // The `file.buffer` half of DIVERGENCE 3 — a Buffer is turned into a
  // single-chunk `Readable` by `toNodeReadable`, so nothing base64-encodes the
  // payload on the way to the SDK.
  const Image = await uploadOnCloudinary(imageBuffer);

  if (!Image) {
    throw new ApiError(
      400,
      `Error while uploading the ${key}. Please check file size and format.`,
    );
  }

  // BOTH the delivery URL and the public id are stored, every time. The public
  // id is what makes the next replacement a cheap, exact `destroy()` instead of
  // a URL parse; the URL is what the frontend renders.
  const updatePayload = {
    [key]: Image.secure_url || Image.url,
    [existingPublicIdKey]: Image.public_id,
  };

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: updatePayload,
    },
    {
      new: true,
    },
  ).select(PUBLIC_ITEM);

  if (!updatedUser) {
    throw new ApiError(500, `server site error while uploading the ${key}`);
  }

  // The two computed keys are re-applied after the `toObject()` spread
  // explicitly. Redundant today, and deliberate: a Mongoose virtual or a
  // transform could shadow them, and these are the two values the client
  // actually came for.
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...updatedUser.toObject(),
        [key]: updatedUser[key],
        [existingPublicIdKey]: updatedUser[existingPublicIdKey],
      },
      `${key} is uploaded successfully`,
    ),
  );
};

const memberHandler = async (req, res) => {
  // `PUBLIC_MEMBER_ITEM` (a projection STRING) rather than
  // `.select(PUBLIC_MEMBER_ITEM)`; both are accepted by Mongoose. This is the
  // UNAUTHENTICATED member list, so the projection is the whole security
  // boundary: it is what keeps `password` and `refreshTokens` out, and — since
  // the H1 fix — also `email`, `phone`, `uniID`, `roles`, `isValid`, the two
  // Cloudinary `*PublicId` write primitives and `socialLinks`. See the allow-list
  // and the per-field reasoning in `constants.js`; do NOT widen this back to
  // `PUBLIC_ITEM` without re-reading that block, because `roles` is the input
  // `adminAuth.js` authorises on and would turn this into a ranked list of
  // which accounts are worth attacking.
  //
  // `{ isValid: true }` — PENDING ACCOUNTS ARE EXCLUDED AT THE QUERY, NOT AT THE
  // PROJECTION. The client used to do this itself: `Member.jsx:59` filters
  // `user?.isValid !== false`. That client filter is now REDUNDANT, because
  // `isValid` is not projected — with the field absent, `undefined !== false` is
  // `true` and the predicate passes EVERY document, so the filter silently
  // became a no-op and every unverified account started rendering in the public
  // directory. Filtering here instead is strictly better on three counts:
  //   1. it moves the reasoning burden off every current and future consumer of
  //      this endpoint onto the one place that owns the rule;
  //   2. it needs no projection change, so the pending/published distinction
  //      stays out of the anonymous payload entirely;
  //   3. it does not rely on a client shipping the compensating filter, which is
  //      the only thing that made the gap survivable.
  //
  // WHY IT MATTERS — SPAM AND THROWAWAY REGISTRATIONS. `POST /auth/register`
  // accepts an attacker-chosen `fullName` with no verification step, so an
  // UNVERIFIED account is the cheapest possible thing an attacker can create,
  // and it is exactly the class of account most likely to be spam. Publishing
  // those rows in the public directory is how an attacker gets an attacker-named
  // entry rendered on the club's member page, to every visitor, indefinitely —
  // which is why this is enforced on the harvest surface and not left to the
  // card renderer.
  //
  // `isValid` IS NOT RE-ADDED TO THE PROJECTION to make this observable to the
  // client. There is nothing for a caller to re-derive once the query excludes
  // them, and re-adding it would restore an ID-oracle for pending accounts.
  //
  // EDGE CASE, DOCUMENTED RATHER THAN PAPERED OVER: `{ isValid: true }` matches
  // on the STORED value, and a Mongo query does not apply Mongoose schema
  // defaults — `user.model.js:223`'s `default: false` is applied when a document
  // is HYDRATED for reading, not when a filter is matched. So a legacy document
  // written before `isValid` ever existed (i.e. with the field ABSENT) does NOT
  // match `{ isValid: true }` and is therefore EXCLUDED from the directory. That
  // is the fail-closed direction, which is the right one for an anonymous
  // surface — an account of unknown provenance is not published — and it is
  // consistent with `forgottenPasswordHandler`, which likewise queries
  // `{ email, isValid: true }` (`auth.controller.js:592-595`). In practice every
  // account created by this codebase stores the field explicitly: registration
  // writes `isValid: false` (`auth.controller.js:217`) and OTP verification
  // flips it (`auth.controller.js:318`). If a member ever reports vanishing from
  // the directory, THIS is the first thing to check — a one-off
  // `updateMany({ isValid: { $exists: false } }, { $set: { isValid: true } })`
  // backfills it, but that is a deliberate data decision, not a code change.
  const member = await User.find({ isValid: true }, PUBLIC_MEMBER_ITEM);

  return res.status(200).json(new ApiResponse(200, member, 'Members data'));
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);

  // ONE message for "no such user" and "wrong current password", so this
  // endpoint cannot be used to probe which ids exist.
  if (!user || !(await user.isPasswordCorrect(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  // 6 characters here versus 8 in `validatePasswordStrength`. Deliberate
  // inconsistency in the ORIGINAL and preserved: the published registration and
  // reset policy is 8+ with character-class rules, and this endpoint has always
  // been the weaker one. Narrowing it to 6 is recorded here as a finding for a
  // follow-up; adding the full policy check now would break every member whose
  // current password was set through this route.
  if (!newPassword || newPassword.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  user.password = newPassword;
  // Full validation, unlike the auth controller's OTP paths: a schema violation
  // here must abort the password change rather than persist an invalid hash.
  await user.save();

  // `refreshTokens` is NOT cleared, so every other session survives a password
  // change. Preserved from the original; see the same finding in
  // `resetPasswordHandler`.

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'Password updated successfully'));
};

const deleteOwnAccount = async (req, res) => {
  // Hard delete of the authenticated user's OWN document — the only account
  // self-service endpoint in the API, and the reason the id comes from
  // `req.user` and never from a body or a param.
  const user = await User.findByIdAndDelete(req.user._id);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Related documents (posts, comments, projects, developer profiles) are NOT
  // cascaded. They are left behind, which is the original behaviour; a real
  // cleanup would need a per-collection decision (anonymise vs delete) that is
  // a product call, not a porting one.

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'Account deleted successfully'));
};

export {
  changePassword,
  deleteOwnAccount,
  getUserInfo,
  getUserInfoById,
  memberHandler,
  removeJobPipelineProfile,
  requestJobPipelineProfile,
  updateUserInfo,
  uploadORchangeIMG,
};
