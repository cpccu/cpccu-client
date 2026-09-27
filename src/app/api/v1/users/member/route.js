import { memberHandler } from '@/lib/server/controllers/user.controller';
import { memberListRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/users/member` — the public members listing.
 *
 * ============================ `public: true` — STILL FLAGGED ============================
 * ANONYMOUS, and that is a faithful port: `user.route.js` registered
 * `router.route('/member').get(memberHandler)` with no `verifyToken`, while
 * `/user` in the same file had it. The asymmetry is the original's, and it is
 * still the right call — the members page (`src/app/(main)/member/page.jsx`) is
 * public by definition, so gating this route would break a shipped page.
 *
 * ============================ WHAT CHANGED (H1, OWNER-APPROVED) ============================
 * The route is still anonymous; WHAT IT RETURNS IS NOT. It previously projected
 * through `PUBLIC_ITEM`, which meant ONE unauthenticated request returned every
 * member's `email`, `phone`, `uniID`, `roles`, `isValid`, `avatarPublicId`,
 * `coverImagePublicId` and `socialLinks`. `roles` is the field `adminAuth.js`
 * authorises the entire admin panel on, so that response was a RANKED TARGET
 * LIST for credential stuffing, and the two `*PublicId` values are Cloudinary
 * WRITE primitives rather than display data. The controller now projects
 * through `PUBLIC_MEMBER_ITEM`, an explicit allow-list; the per-field reasoning
 * is in `constants.js`.
 *
 * `memberListRateLimiter` (60/min per IP) is ALSO new, and was likewise
 * absent. The route is the cheapest possible harvest loop and the only endpoint
 * that returns the whole collection in one response, so it had no throttle at
 * all. The chosen budget and its reasoning are on the limiter itself in
 * `rateLimit.js`. Per-IP is the right key here precisely BECAUSE the route is
 * public: there is no authenticated principal at the point the limiter runs.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads the database per request and must never be
// prerendered into a static member list at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  public: true,
  limiter: memberListRateLimiter,
  controller: memberHandler,
});
