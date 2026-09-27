import { updatePostHandler } from '@/lib/server/controllers/post.controller';
import { userUploadRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH /api/v1/posts/update-post/:id` — edit the caption and/or replace media.
 *
 * AUTHENTICATED (`public` absent), and the id comes from the PATH SEGMENT, which
 * the bridge supplies as `params: routeContext.params` so the controller's
 * `req.params.id` read works.
 *
 * THE OWNERSHIP CHECK IS THE ONLY AUTHORISATION HERE and it is inside the
 * handler (`post.owner === req.user._id`), which is faithful to the Express
 * original. It runs BEFORE any upload, which is what stops this route being used
 * as a free Cloudinary upload service for someone else's post.
 *
 * ================= PLATFORM CONSEQUENCE — SAME CEILING AS create-post =================
 * The Express original accepted up to 20 × 5 MB ≈ 100 MB here too, because
 * `upload.array('media', 20)` streamed to disk. On Vercel the request is rejected
 * at the EDGE at 4.5 MB with `413 FUNCTION_PAYLOAD_TOO_LARGE` before this
 * function runs; `assertBodySizeWithinLimit` then enforces `MAX_UPLOAD_BYTES`
 * (4 MiB) on a declared `Content-Length`, and `readMultipart` re-checks it per
 * file because that header is client-supplied. So the 20-file worst case is
 * UNREACHABLE on the target platform and a single file is what the 4 MiB cap
 * actually governs.
 *
 * `maxFiles: 20` is therefore DOCUMENTARY ONLY — `createShim` takes
 * `{ params, fileField }` and enforces no file count (the bridge warns once).
 * Do not add validation against it.
 *
 * `fileField: 'media'` reproduces multer's field filter for
 * `upload.array('media', 20)`; see the longer note in
 * `src/app/api/v1/posts/create-post/route.js`.
 *
 * TWO BEHAVIOURS ARE PRESERVED AND ARE WORTH KNOWING BEFORE DEBUGGING:
 *  - `caption: ''` LEAVES THE OLD CAPTION (it becomes `undefined`, which Mongoose
 *    ignores on save) — it does not erase it;
 *  - MEDIA DROPPED FROM `existingMedia` IS NOT DESTROYED IN CLOUDINARY. The list
 *    is replaced wholesale, nothing diffs and nothing calls destroy, so every
 *    edit leaks the removed assets permanently. See `post.controller.js`.
 *
 * ================================ RATE LIMIT (M1) ================================
 * `userUploadRateLimiter` (20/hour), PER-USER rather than per-IP — the campus
 * NAT reasoning and the multi-account tradeoff are both on the limiter in
 * `rateLimit.js`. Mounted as `userLimiter`, which runs after `verifyToken`, so
 * a refused edit never reaches the re-upload loop. This route is the second half
 * of the pair that made a post's media a paid, unmetered write primitive:
 * limiting `create-post` alone still leaves an owner able to loop edits against
 * one post forever, each iteration replacing every file.
 */

// `nodejs` because this route reaches `mongoose`, `jsonwebtoken` and the
// Cloudinary SDK, none of which are Edge-compatible. `force-dynamic` because it
// reads a multipart body, an auth cookie and a dynamic segment, and must never be
// prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute({
  method: 'PATCH',
  userLimiter: userUploadRateLimiter,
  fileField: 'media',
  maxFiles: 20,
  controller: updatePostHandler,
});
