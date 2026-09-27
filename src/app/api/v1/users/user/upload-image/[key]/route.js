import { uploadORchangeIMG } from '@/lib/server/controllers/user.controller';
import { userUploadRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH /api/v1/users/user/upload-image/:key` — set the caller's avatar or cover.
 *
 * The `key` segment selects WHICH image: `avatar` or `coverImage`. The
 * controller reads it as `req.params.key` and drives the delete-before-upload
 * Cloudinary ordering from it, so the bridge's unconditional
 * `params: routeContext.params` is what makes that read work.
 *
 * ==================== THE ROUTING TRAP THIS FILE SITS ON ====================
 * App Router resolves STATIC SEGMENTS BEFORE DYNAMIC ONES. This file is
 * `user/upload-image/[key]`, and the sibling `src/app/api/v1/users/user/[id]/route.js`
 * is `user/[id]`. A request for `/api/v1/users/user/upload-image/abc` has three
 * segments after `/user`, so `[id]` (one segment) cannot match it at all, and
 * `upload-image/[key]` does. Nothing is ambiguous and nothing shadows anything —
 * but the reason is ORDERING, not LENGTH-ARITHMETIC, and the reason still applies
 * to `projects/user/[userId]` vs `projects/[id]` below.
 *
 * THE CONSEQUENCE TO BE AWARE OF: because the static `upload-image` segment wins,
 * a request for `/api/v1/users/user/upload-image` (no trailing id) does NOT reach
 * this file with an empty `key` — it 404s, where the Express original's
 * `/user/:id` would have matched with `id === 'upload-image'`. Nothing in the
 * client calls that, and treating it as a bug to "fix" would mean re-exposing
 * `[id]` to the literal string `upload-image`. Recorded, not repaired.
 *
 * `fileField: 'image'` REPRODUCES `upload.single('image')`. This is not
 * cosmetic: multer's `single(field)` FILTERS by field name, so a part named
 * anything else was rejected with `MulterError: Unexpected field` and did not
 * reach `req.file`. `createShim` accepts exactly `{ params, fileField }`, and
 * `splitFormData` applies `fileField` as that same filter — so without this
 * option every file part would be collected and `req.file` would be whichever
 * part happened to come first, silently accepting a differently-named upload the
 * original refused.
 *
 * AUTHENTICATED: `public` is absent. The controller also scopes the write to
 * `req.user._id`, so it cannot write to another member's image.
 *
 * ================================ RATE LIMIT (M1) ================================
 * `userUploadRateLimiter` (20/hour), and it is the PER-USER variant rather than
 * the per-IP `uploadRateLimiter`. A university campus reaches this site through
 * ONE NAT address, so a per-IP 20/hour was a budget shared by every student
 * behind it: twenty members each uploading one avatar, and the twenty-first
 * gets a 429 on their profile picture. Per-user keying is also genuinely weaker
 * against an attacker who controls several accounts, and that tradeoff is
 * written out in full on the limiter in `rateLimit.js` — read it before
 * "simplifying" this to the per-IP limiter used by the admin upload.
 *
 * It is mounted as `userLimiter`, not `limiter`, because a per-user key needs a
 * VERIFIED user id and the ordinary `limiter` runs before authentication. The
 * `userLimiter` hook runs after `verifyToken` and after the admin check, and
 * before the handler, so an upload is refused before the Cloudinary call and
 * before the ~35–40 MB of heap `readMultipart` costs. This is the endpoint the
 * omission from the earlier phase actually mattered on: the avatar loop is
 * one request per iteration and every iteration costs a paid outbound transform.
 */

// `nodejs` because this route reaches `mongoose`, `jsonwebtoken` and the
// Cloudinary SDK, none of which are Edge-compatible. `force-dynamic` because it
// reads a multipart body and an auth cookie, and must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute('PATCH', {
  userLimiter: userUploadRateLimiter,
  fileField: 'image',
  controller: uploadORchangeIMG,
});
