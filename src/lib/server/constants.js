import 'server-only';

export const DB_NAME = 'CPCCU';

/**
 * Maximum size of a single uploaded file, in BYTES. 4 MiB = 4 * 1024 * 1024.
 *
 * DELIBERATELY reduced from the backend's 5 MB
 * (`cpccu-server/src/middlewares/upload.middleware.js:16`). Vercel rejects ANY
 * request body over 4.5 MB with `413 FUNCTION_PAYLOAD_TOO_LARGE`, so a 5 MB cap
 * is unreachable by construction: the request never reaches the function and the
 * client sees an opaque platform error instead of the documented 400. Keeping
 * the limit just under the platform ceiling means the limit is enforced by OUR
 * code and produces the documented 400.
 *
 * 4 MiB leaves ~0.36 MB of headroom for multipart/form-data framing (boundaries,
 * part headers, other text fields) around the file itself.
 *
 * This lives in `constants.js` — a leaf module with no imports — rather than in
 * `cloudinary.js` because BOTH the uploader (`cloudinary.js`) and the error
 * shaper (`errors.js`) need the number, and the error shaper must be able to
 * build the documented 400 message without importing the Cloudinary SDK.
 *
 * THIS CAP GOVERNS `multipart/form-data` ONLY. It is the multer `fileSize` port,
 * not a general request-body cap — see `MAX_JSON_BODY_BYTES` for the JSON one.
 * Reusing this number for JSON was a real bug: a 5 MB `application/json` POST
 * was answered with "File size too large. Profile picture must be less than
 * 4MB." — an upload error message, on a request that carried no file.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Maximum size of a NON-multipart request body, in BYTES.
 *
 * PORT OF the Express original's `express.json({ limit: LIMIT })` /
 * `express.urlencoded({ limit: LIMIT })` (`app.js:32-33`, `LIMIT = '5mb'`),
 * reduced to 4 MiB for the SAME reason as `MAX_UPLOAD_BYTES`: a 5 MB cap sits
 * ABOVE Vercel's 4.5 MB hard request-body ceiling, so the parser limit could
 * never fire — the platform would reject the request with
 * `413 FUNCTION_PAYLOAD_TOO_LARGE` first, and the client would get an opaque
 * edge error instead of our documented 400. A cap under the ceiling means OUR
 * code produces the documented response.
 *
 * 4 MiB of JSON is far beyond anything this app sends: the largest legitimate
 * payloads are a blog post, a profile, a committee list or a bulk admin edit,
 * all of which are kilobytes. The number is a memory bound, not a product
 * limit, and it is deliberately SEPARATE from `MAX_UPLOAD_BYTES` so the
 * multipart cap can be tuned (or raised towards the platform ceiling) without
 * silently changing what a JSON caller is told.
 *
 * DECLARED DIVERGENCE — see the block at the top of `http.js`. The Express
 * original did NOT reject an oversized JSON body with a 4xx at all: body-parser
 * raised a `PayloadTooLargeError` whose message (`'request entity too large'`)
 * matched none of the four branches of the error handler in `app.js:78-117`, so
 * it fell through to the catch-all and was returned as a **500** with that raw
 * body-parser text. This port returns a **400** with a message that names the
 * limit. Two things changed at once (status AND message) and both are
 * deliberate: a 500 blames the server for a client mistake, and the original
 * message tells a caller nothing about the actual ceiling.
 */
export const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;

/**
 * The single source of truth for the upload size rejection message.
 *
 * It lives here, next to the number, so the message thrown by `cloudinary.js` and
 * the message built by the `LIMIT_FILE_SIZE` branch of `toErrorResponse` in
 * `errors.js` can never drift apart again. They previously both said "less than
 * 5MB" while the enforced cap was 4 MiB, which instructed a user to retry with a
 * file the server would reject a second time.
 *
 * The figure is derived from `MAX_UPLOAD_BYTES` rather than written out, so
 * changing the cap changes the message with it.
 *
 * "AT MOST", not "less than": every comparison against `MAX_UPLOAD_BYTES` in the
 * codebase is a strict `>` (`request.js`, `cloudinary.js`), so a body of exactly
 * 4 MiB is ACCEPTED. The previous wording told a user that exactly 4 MiB would be
 * rejected when it is not, and — worse — invited a retry loop at the boundary.
 * The message now matches the comparison.
 */
export function uploadSizeMessage() {
  return `File size too large. Profile picture must be at most ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`;
}

/**
 * The rejection message for a non-multipart body over `MAX_JSON_BODY_BYTES`.
 *
 * SEPARATE FROM `uploadSizeMessage` ON PURPOSE. The upload message says
 * "Profile picture" and is meaningless to a caller that sent JSON, and reusing
 * it is exactly the defect this pair of functions exists to prevent: the message
 * a client acts on must name the limit that client actually hit. Derived from
 * `MAX_JSON_BODY_BYTES` so the two can never drift, for the same reason as
 * `uploadSizeMessage`.
 */
export function jsonBodySizeMessage() {
  return `Request body too large. JSON payloads must be at most ${MAX_JSON_BODY_BYTES / (1024 * 1024)}MB.`;
}

/**
 * Cookie attributes for the auth cookies.
 *
 * `path: '/'` is added here and was NOT in the Express original. Express
 * defaults an unset cookie `path` to the path of the route that set it, so on
 * the backend every `res.cookie(...)` call was effectively pinned to whatever
 * sub-path served it. If we port that omission, the logout / clear-cookie flow
 * silently fails to match the cookie it is trying to clear (the browser keeps
 * the original) and the user stays logged in with no error anywhere. Specifying
 * `path` explicitly makes the scope deterministic regardless of which route
 * handler sets or clears the cookie.
 */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  // `secure` is CONDITIONAL on NODE_ENV rather than hard-coded to `true`.
  //
  // `secure: true` means the browser will only ever send this cookie over HTTPS.
  // On a plain-HTTP `http://localhost:3000` the browser silently REFUSES to
  // store or send the cookie — no error, no console warning the developer will
  // notice. The visible symptom is that the transparent refresh path in
  // `auth.js` never fires (no `refreshToken` cookie reaches the server) and every
  // session dies after the 15-minute access-token expiry instead. That is a
  // dev-only trap, so the production deployment is unaffected and the dev
  // experience stays intact.
  //
  // A hard-coded `secure: true` is the more secure default and remains in force
  // for every deployed environment; only a non-production build relaxes it.
  secure: process.env.NODE_ENV === 'production',
  // `sameSite: 'lax'` — DELIBERATE DIVERGENCE from the Express original, which
  // used `'none'`. The original needed `'none'` because the browser app on a
  // different origin called an API on another origin (hence the CORS allowlist
  // in `cpccu-server/src/app.js:14-27` and `express.urlencoded()`), so the
  // cookie had to be cross-site-capable.
  //
  // That whole topology disappears in this migration: the API is mounted INSIDE
  // the Next.js app at `/api/...`, so it is SAME-ORIGIN. Once the client stops
  // calling the API cross-origin there is no longer a cross-site cookie to
  // permit, and `'none'` (which REQUIRES `Secure` and explicitly opts the cookie
  // into cross-site sending) becomes pure attack surface. `'lax'` is what makes
  // the deployment same-origin-safe: a cross-site `<form method="POST">` no
  // longer carries the cookie, so a bare cross-site form POST is unauthenticated
  // and the CSRF surface closes. See `assertSameOrigin` in `request.js` for the
  // second layer.
  //
  // `'lax'` still satisfies everything the app needs: it is sent on same-site
  // `fetch`/XHR (all of which are same-site here) and on top-level GET
  // navigation, which is what the `/reset-password/[code]/[token]` email link
  // relies on — a top-level GET navigation, exactly the one case `'strict'`
  // would break and `'lax'` permits.
  //
  // This change ONLY works once the client stops calling the API
  // cross-origin. Flipping it back to `'none'` before that migration lands
  // re-opens CSRF.
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Day-of-month the annual club maintenance window opens on (the 15th).
export const MAINTENANCE_DAY = 15;
// 7 days: how long a generated / refreshed credential stays valid.
export const TOKEN_TIME = 7;
// 2 minutes: OTP lifetime. Short because the code is a single guessable factor
// on an unauthenticated endpoint; the auth controller adds its own per-OTP
// attempt counter on top of this.
export const OTP_TIME = 2;
// 5 minutes: password-reset link lifetime, per the same reasoning.
export const RESET_TIME = 5;

/**
 * Mongo projection for user documents returned to an AUTHENTICATED caller — the
 * caller's OWN document (`getUserInfo`, `updateUserInfo`, `uploadORchangeIMG`,
 * `loginHandler`) or an ADMIN's read of any member (`admin.controller.js`).
 *
 * This is a PROJECTION STRING (space-separated field list), NOT a projection
 * object — mongoose passes it straight to the driver as the `fields` argument.
 *
 * SECURITY NOTE, updated after the H1 fix. This projection exposes `uniID` (the
 * institutional Student ID), `roles` (privilege level) and the two Cloudinary
 * `*PublicId` values, which is acceptable ONLY because every read through it is
 * authenticated and every ANONYMOUS read is now projected through
 * `PUBLIC_MEMBER_ITEM` instead. It must not be reintroduced on a `public: true`
 * route. The two `*PublicId` fields are a WRITE primitive — anyone holding one
 * can call the destroy endpoint — so they are the first thing to drop if this
 * projection is ever widened onto a new surface.
 */
export const PUBLIC_ITEM =
  '_id fullName email phone bio department section github linkedin portfolio skills avatar avatarPublicId coverImage coverImagePublicId batch uniID socialLinks roles isValid jobPipelineStatus jobPipelineTitle jobPipelineRejectionReason createdAt updatedAt';

/**
 * Mongo projection for the ANONYMOUS, unauthenticated member reads —
 * `GET /api/v1/users/member` (`memberHandler`) and
 * `GET /api/v1/users/user/:id` (`getUserInfoById`). Owner-approved (H1).
 *
 * This is an ALLOW-LIST: a field is public because it is named here, not
 * because someone remembered to remove it. That is the whole point — the
 * previous state was a DENY-list, where the safe outcome required the schema to
 * stop growing.
 *
 * WHAT IS IN IT, and why each is needed to render a public member card/profile:
 *  - `_id`  — the profile link. `AboutCard.jsx` falls back to `_id` when `uniID`
 *             is absent, and the `uniID` lookup branch of `getUserInfoById`
 *             still resolves by Student ID, so a shared profile URL must keep
 *             working from the id the list hands out.
 *  - `fullName`, `avatar` — the card and the hero.
 *  - `batch`, `section`, `department` — the academic metadata a directory
 *     listing exists to show. Note `section` and `department` are NOT contact
 *     information: they are cohort labels, and `section` is a single letter.
 *  - `jobPipelineStatus` — the public developer page's listing filter. Without
 *     it an approved member's profile renders as unpublished.
 *  - `github`, `linkedin`, `portfolio`, `bio` — links and self-description the
 *     member published FOR public display.
 *
 * WHAT IS EXCLUDED, and why each exclusion is load-bearing:
 *
 *  - `email` and `phone` — direct personal contact details. One unauthenticated
 *     call to `/users/member` returned the entire membership's contact list; the
 *     `ContactSection`/`ProfileHero` "Email" row and the `AboutCard` `mailto:`
 *     are the only consumers, and they degrade to a hidden row rather than
 *     erroring (see the field-usage report). Nothing in a public directory
 *     needs them, and they are the two fields most likely to end up in a
 *     scraped dataset.
 *
 *  - `uniID` — the institutional Student ID. It is a real-world identifier, it is
 *     enumerable, and combined with the `uniID` branch of `getUserInfoById` it
 *     makes a *stable, guessable* lookup key for a member's record. `_id` is
 *     already a sufficient, unguessable link target.
 *
 *  - `roles` — THIS IS THE AUTHORISATION INPUT, NOT PROFILE DATA. `adminAuth.js`
 *     grants the entire admin surface to `admin` / `moderator` / `mentor`, so
 *     publishing `roles` on an anonymous endpoint hands an attacker a ranked
 *     target list: exactly which accounts are worth credential-stuffing,
 *     phishing, or a targeted password-reset spam. It must never appear on a
 *     read that does not require a session. (The member page's
 *     `roleOrder` sort in `Member.jsx` degrades to an alphabetical sort, and
 *     `AboutCard`'s displayed position is hard-coded to `"member"` anyway, so
 *     the visible cost is zero.)
 *
 *  - `isValid` — the OTP-verification flag. The member page filters on
 *     `user?.isValid !== false`; with the field absent that predicate is true for
 *     every document, so unverified accounts would newly appear in the public
 *     listing. This is a real behaviour change and is reported, not hidden; the
 *     fix belongs server-side (`memberHandler` filtering on `isValid: true`) if
 *     the club wants pending accounts excluded again.
 *
 *  - `avatarPublicId` and `coverImagePublicId` — these are CLOUDINARY WRITE
 *     PRIMITIVES, not display URLs. The delivery URL is `avatar` /
 *     `coverImage`; the `*PublicId` is the exact handle the destroy call needs,
 *     and `uploadORchangeIMG` reads it to delete the previous asset. Publishing
 *     a write primitive to an anonymous reader is a capability leak, not an
 *     information leak, and it is the single highest-value field on this schema
 *     to keep off a public read. (`M2` records that the URL-parse fallback for
 *     pre-`avatarPublicId` documents still exists server-side; that is
 *     independent of this projection and does not require exposing the id.)
 *
 *  - `socialLinks` — a second, unstructured copy of the same three URLs the
 *     caller-supplied `github`/`linkedin`/`portfolio` fields already carry.
 *     Nothing renders it, so it is pure extra surface.
 *
 *  - `skills`, `coverImage`, `jobPipelineTitle`, `jobPipelineRejectionReason`,
 *     `createdAt`, `updatedAt` — dropped as outside the minimum a directory
 *     listing needs. `jobPipelineRejectionReason` in particular is INTERNAL
 *     moderator feedback ("your title was rejected because…") and must not be
 *     published; that is an accidental-disclosure risk, not a privacy one.
 *
 * NOT CHANGED BY THIS CONSTANT: the admin panel, the self reads and the
 * `login` response all still use `PUBLIC_ITEM`. `adminAuth.js` authorises on
 * `roles`, so an admin surface that lost it would lock every moderator out.
 */
export const PUBLIC_MEMBER_ITEM =
  '_id fullName avatar bio department section batch github linkedin portfolio jobPipelineStatus';

/**
 * Name of the single Mongo document that holds the cumulative visitor counter.
 *
 * Moved here from `controllers/visitor.controller.js` to BREAK A CIRCULAR
 * IMPORT. In the Express codebase `services/statistics.service.js:9` imports
 * `VISITOR_RECORD_NAME` from the visitor controller, and the visitor controller
 * imports back from the services layer — a cycle. ES modules tolerate cycles
 * only when the binding is not read during module evaluation, which makes them
 * load-order dependent and genuinely break under the bundler Next uses.
 * `constants.js` is a leaf with no imports, so it is a safe home for the value.
 */
export const VISITOR_RECORD_NAME = 'total-visitors';
