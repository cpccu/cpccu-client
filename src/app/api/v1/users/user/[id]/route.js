import { getUserInfoById } from '@/lib/server/controllers/user.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/users/user/:id` — another member's public profile.
 *
 * ============================ `public: true` — FLAGGED ============================
 * This route is ANONYMOUS, and that is a faithful port, not an oversight: the
 * Express original registered `router.route('/user/:id').get(getUserInfoById)`
 * with NO `verifyToken` in the chain (`user.route.js`), while `/user` two lines
 * above it DID have it. The asymmetry is the original's.
 *
 * IT IS PRESERVED DELIBERATELY. Gating it is a product decision, not a porting
 * one: the frontend's public profile pages (`src/app/(main)/profile/[id]/` and
 * `src/app/(main)/users/profile/[id]/`) are anonymous and call it, so requiring
 * a session would break shipped pages.
 *
 * ============================ WHAT CHANGED (H1, OWNER-APPROVED) ============================
 * The route is still anonymous; WHAT IT RETURNS IS NOT. The response used to be
 * projected through `PUBLIC_ITEM` (`constants.js`), so this endpoint let an
 * anonymous caller read a member's `email`, `phone`, `uniID`, `roles`,
 * `isValid`, `avatarPublicId`, `coverImagePublicId` and `socialLinks` — the
 * `roles` value being the input `adminAuth.js` authorises the admin panel on.
 * It now projects through `PUBLIC_MEMBER_ITEM`, an explicit allow-list; the
 * per-field reasoning, including why `roles` and the two Cloudinary `*PublicId`
 * write primitives must never appear on an anonymous read, is in `constants.js`.
 *
 * THE `uniID` LOOKUP BRANCH REMAINS, and that is a deliberate, reported
 * tradeoff rather than an oversight. The controller still accepts a Student ID as
 * the path segment, because `AboutCard.jsx:47` links to
 * `/profile/${Data?.uniID || Data?._id}` and Student-ID URLs are in the wild
 * (bookmarks, shared links). What changed is the CONSEQUENCE: with `uniID` no
 * longer in the response, the branch is now an IDENTIFIER ORACLE — a 200 versus
 * a 404 confirms whether a guessed Student ID is registered — and no longer a
 * DISCLOSURE. See the report for the full argument on whether it should be
 * removed; the answer given there is "not unilaterally, and not yet".
 *
 * The id is validated as an ObjectId inside the controller and a malformed one
 * yields the original's 404-ish response rather than a database error.
 *
 * SEE ALSO `src/app/api/v1/users/user/upload-image/[key]/route.js` for why this
 * dynamic segment is reached for `/user/upload-image/…` at all — the answer is
 * that it is not, and that is load-bearing.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads a dynamic route segment and must never be
// prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  public: true,
  controller: getUserInfoById,
});
