import { uploadAdminImage } from '@/lib/server/controllers/adminContent.controller';
import { uploadRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/admin/uploads/image` — the admin panel's image upload.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js`. Omitting it would leave the route
 * authenticated but with no per-action check, so any logged-in member could
 * upload. `adminAuth.js` fails closed, so that mistake is the recoverable one.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/uploads/image')` gives
 * `path === '/uploads/image'`, `resource === null`, **`isUpload === true`**.
 * The `isUpload` flag is what makes this the ONLY non-`GET` route a MODERATOR
 * may reach, and it is an EXACT `===` match on the whole mount-relative path —
 * deliberately NOT a prefix match, so `/uploads/image-2` or
 * `/uploads/image/<id>` would not inherit it. Do not "simplify" it to
 * `startsWith`. `mentor` → DENY, because a `POST` is never a read no matter
 * which path it lands on; a mentor has no upload access at all, and adding this
 * path to `mentorReadPaths` would grant one.
 *
 * `fileField: 'image'` REPRODUCES `upload.single('image')`, which is what the
 * Express router passed between the `router.use` line and this handler
 * (`admin.route.js:50`). This is not cosmetic: multer's `single(field)` FILTERS
 * by field name, so a part named anything else was rejected with
 * `MulterError: Unexpected field` and never reached `req.file`. `createShim`
 * accepts exactly `{ params, fileField }` and `splitFormData` applies
 * `fileField` as that same filter, so without this option every file part would
 * be collected and `req.file` would be whichever part happened to come first —
 * silently accepting a differently-named upload the original refused.
 *
 * ============================== TRUST BOUNDARY ==============================
 * `uploadAdminImage` reads TWO VALUES FROM THE REQUEST BODY, i.e. from the
 * client, and neither is allowlisted (preserved, see
 * `adminContent.controller.js` for the full note):
 *  - `folder` becomes the DESTINATION PATH inside the Cloudinary account, so a
 *    caller can scatter assets into any folder, including folders belonging to
 *    other features. Nothing in this application resolves an asset by folder, so
 *    the impact is storage layout and quota rather than access control.
 *  - `uploadPreset` (and the legacy `upload_preset` spelling) SWITCHES THE
 *    UPLOADER from a signed `upload_stream` to an UNSIGNED
 *    `unsigned_upload_stream` against whatever preset name the caller supplied.
 *    A caller can therefore select ANY unsigned upload preset configured on this
 *    Cloudinary account and have this endpoint use it. This is the sharper edge
 *    of the two, and it is the reason `admin: true` on this file is not optional
 *    bookkeeping: with it, the reachable caller set is admin / moderator (by
 *    design — `isUpload` exists so moderators can upload); without it, every
 *    member is.
 * What DOES bound the damage is in `cloudinary.js`: `allowed_formats` is applied
 * server-side against the SNIFFED content (the client-declared multipart
 * `Content-Type` is ignored), and the payload is capped by both `readMultipart`
 * and the uploader. Narrowing the folder or whitelisting presets is a security
 * change with a product decision attached, not a porting change — do not do it
 * as a side effect of a migration.
 *
 * NO CATCH-ALL. The size ceiling in `http.js` still applies to every request
 * through this route.
 *
 * ================================ RATE LIMIT (M1) ================================
 * `uploadRateLimiter` (20/hour per IP) is NEW — the Express route declared no
 * limiter and the earlier port faithfully added none, which is how a
 * moderator-costing paid outbound Cloudinary transform per iteration, with
 * ~35–40 MB of heap per request, ended up unmetered. This route keeps the
 * PER-IP variant even though the three member-facing upload routes use the
 * per-user one, and the reason is the reachability difference: `admin: true`
 * means the caller is already one of admin / moderator, and an anonymous caller
 * never reaches this handler at all, so there is no shared-NAT crowd to deny
 * service to. The reasoning, and the tradeoff per-user keying accepts in the
 * other direction, are both on the limiter in `rateLimit.js`.
 */

// `nodejs` because this route reaches the Cloudinary SDK and `Buffer`, neither of
// which is Edge-compatible. `force-dynamic` because it reads a multipart body
// and an auth cookie, and must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  admin: true,
  limiter: uploadRateLimiter,
  fileField: 'image',
  controller: uploadAdminImage,
});
