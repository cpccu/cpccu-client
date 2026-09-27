import { createPostHandler } from '@/lib/server/controllers/post.controller';
import { userUploadRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/posts/create-post` — create a post with up to 20 media files.
 *
 * AUTHENTICATED (`public` absent). `owner` is taken from `req.user._id`, never
 * from the body, so there is no impersonation path.
 *
 * ================= PLATFORM CONSEQUENCE — READ THIS BEFORE "FIXING" IT =================
 * THE EXPRESS ORIGINAL ACCEPTED 5 MB × 20 FILES ≈ 100 MB IN ONE REQUEST.
 * `upload.array('media', 20)` with `multer.diskStorage` streamed each file to
 * `./public/temp`, so the server never held them all. On Vercel the request
 * NEVER ARRIVES.
 *
 * WHAT ACTUALLY HAPPENS, IN ORDER:
 *
 *  1. VERCEL'S EDGE REJECTS THE REQUEST BODY AT 4.5 MB with
 *     `413 FUNCTION_PAYLOAD_TOO_LARGE`, before this function is invoked at all.
 *     That is the first and hardest ceiling, and it is the platform's, not ours.
 *  2. For a request that DOES get through, `apiRoute`'s
 *     `assertBodySizeWithinLimit` rejects a declared `Content-Length` over
 *     `MAX_UPLOAD_BYTES` (4 MiB) with a 400 BEFORE a single byte is buffered —
 *     this is what stops ~50 concurrent uploads from OOM-killing a 2 GB instance
 *     and every co-resident function on it.
 *  3. `readMultipart` adds a PER-FILE check over the same 4 MiB, because
 *     `Content-Length` is a client-supplied header that can be lied about or
 *     omitted entirely (chunked encoding sends none).
 *
 * SO THE 20-FILE CEILING IS UNREACHABLE IN PRACTICE, and `maxFiles: 20` below is
 * DOCUMENTARY ONLY: `createShim` accepts exactly `{ params, fileField }` and
 * contains no file-count limit anywhere. A multi-file post is bounded by the
 * 4.5 MB platform cap first, and any single file is bounded by
 * `MAX_UPLOAD_BYTES`. Do not read `maxFiles: 20` as an enforced limit and do not
 * write validation against it; the bridge emits a one-time `console.warn` for
 * exactly this reason. Reported for `shim.js` to grow, not fixed in a route file.
 *
 * `fileField: 'media'` REPRODUCES multer's field filter for
 * `upload.array('media', 20)`. `shim.js`'s own docblock says so directly: a route
 * that mounts `upload.array('media')` SHOULD pass `fileField: 'media'`, because
 * omitting it collects EVERY file part and is "a deliberate superset for the
 * array consumer" — i.e. it would silently accept a differently-named upload the
 * original rejected. `post.controller.js` then reads `req.files` (all of them),
 * so the shim's `file`/`files` split maps onto multer's exactly.
 *
 * THE ORPHANED-ASSET CONSEQUENCE IS PRESERVED, and it is the one real cost of
 * this endpoint: uploads run concurrently via `Promise.all`, and nothing deletes
 * a Cloudinary asset that a later file in the same request failed on. See the
 * note in `post.controller.js`; it is a fidelity decision, not an oversight.
 *
 * ================================ RATE LIMIT (M1) ================================
 * `userUploadRateLimiter` (20/hour), PER-USER rather than per-IP — the campus
 * NAT reasoning and the multi-account tradeoff are both written out on the
 * limiter in `rateLimit.js`. It is mounted as `userLimiter` (post-authentication)
 * rather than `limiter` because a per-user key needs a verified user id, which
 * does not exist at the point the ordinary limiter runs. It is placed before the
 * handler, so a refused post never reaches `Promise.all` over
 * `uploadOnCloudinary` and never spends a paid outbound transform.
 */

// `nodejs` because this route reaches `mongoose`, `jsonwebtoken` and the
// Cloudinary SDK, none of which are Edge-compatible. `force-dynamic` because it
// reads a multipart body and an auth cookie, and must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  userLimiter: userUploadRateLimiter,
  fileField: 'media',
  maxFiles: 20,
  controller: createPostHandler,
});
