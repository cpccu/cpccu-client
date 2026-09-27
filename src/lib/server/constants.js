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
 * Mongo projection for the ANONYMOUS, unauthenticated DIRECTORY LISTING —
 * `GET /api/v1/users/member` (`memberHandler`). Owner-approved (H1).
 *
 * SCOPE: this constant serves the MEMBER PAGE only. It does NOT serve
 * `getUserInfoById`; that handler has its own, deliberately different
 * projection — `PUBLIC_PROFILE_ITEM`, immediately below. The two differ on
 * purpose, and the reason is in that constant's docblock. Do not "simplify" by
 * pointing both handlers at one string: the directory is a HARVEST surface (one
 * call returns every member at once, so it is the one that must be minimal),
 * whereas the profile page is a per-member DISPLAY surface (one call returns one
 * person, and the caller already had to guess an id to get it).
 *
 * This is an ALLOW-LIST: a field is public because it is named here, not
 * because someone remembered to remove it. That is the whole point — the
 * previous state was a DENY-list, where the safe outcome required the schema to
 * stop growing.
 *
 * WHAT IS IN IT, and why each is needed to render a public member card:
 *  - `_id`  — the profile link. `AboutCard.jsx:40` builds
 *             `href={`/profile/${Data?.uniID || Data?._id}`}`, and `uniID` is
 *             deliberately not projected, so the `_id` arm is the one that
 *             actually fires for every card the directory renders. A shared
 *             profile URL has to keep working from the id the list hands out.
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
 *     call to `/users/member` returned the entire membership's contact list, and
 *     these are the two fields most likely to end up in a scraped dataset. The
 *     consumers degrade rather than error, and they now all degrade the same
 *     way: `ProfileHero.jsx:16` and `ContactSection.jsx:34` both
 *     `.filter(... Boolean(href))` and drop the row, and `AboutCard.jsx` now
 *     guards its `mailto:` link with the same `&&` idiom its `batch` row uses,
 *     so a card with no address omits the email row rather than showing a dead
 *     `mailto:undefined`. Reporting rather than assuming the consumer behaviour
 *     was the point; the guards are what make the exclusion invisible.
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
 *     read that does not require a session — on EITHER anonymous projection.
 *     (The consumer-side fallout is now fully absorbed: `Member.jsx`'s
 *     `roleOrder` sort — which could never fire without `roles`, and degraded to
 *     an alphabetical sort — has been deleted, and `AboutCard`'s displayed
 *     position is fed from the `displayPosition: "member"` literal `Member.jsx`
 *     writes, so the visible cost is zero.)
 *
 *  - `isValid` — the OTP-verification flag. It is not projected because the
 *     directory now EXCLUDES pending accounts at the QUERY, not at the
 *     projection: `memberHandler` filters `User.find({ isValid: true }, …)`. So
 *     there is nothing left for a client to re-derive, and the client-side
 *     `user?.isValid !== false` filter that used to sit in `Member.jsx` has been
 *     removed — it was a provable no-op against this filter. Projecting the flag
 *     as well would only give a caller a way to enumerate pending accounts by ID
 *     once the list no longer shows them. This filter is the SINGLE owner of the
 *     rule; do not add a client-side copy.
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
 *     `PUBLIC_PROFILE_ITEM` admits the delivery URL `coverImage` and still must
 *     not admit `coverImagePublicId`, for the same reason.
 *
 *  - `socialLinks` — a second, unstructured copy of the same three URLs the
 *     caller-supplied `github`/`linkedin`/`portfolio` fields already carry.
 *     Nothing renders it, so it is pure extra surface.
 *
 *  - `skills`, `coverImage`, `jobPipelineTitle`, `jobPipelineRejectionReason`,
 *     `createdAt`, `updatedAt` — dropped as outside the minimum a directory
 *     listing needs: the CARD (`AboutCard.jsx:19-44`) renders none of them, so
 *     including them would grow the largest anonymous response in the app for
 *     zero display value. `skills`, `coverImage` AND `createdAt` ARE needed on
 *     the profile page and are re-admitted in `PUBLIC_PROFILE_ITEM` (the
 *     `createdAt` reasoning is spelled out in that constant's own docblock);
 *     `jobPipelineTitle` and `jobPipelineRejectionReason` are not admitted
 *     anywhere, and `jobPipelineRejectionReason` in particular is INTERNAL
 *     moderator feedback ("your title was rejected because…") that must not be
 *     published — that is an accidental-disclosure risk, not a privacy one.
 *     `updatedAt` is not admitted anywhere either: no public surface renders
 *     "last updated".
 *
 * NOT CHANGED BY THIS CONSTANT: the admin panel, the self reads and the
 * `login` response all still use `PUBLIC_ITEM`. `adminAuth.js` authorises on
 * `roles`, so an admin surface that lost it would lock every moderator out.
 */
export const PUBLIC_MEMBER_ITEM =
  '_id fullName avatar bio department section batch github linkedin portfolio jobPipelineStatus';

/**
 * Mongo projection for the ANONYMOUS, unauthenticated PUBLIC PROFILE —
 * `GET /api/v1/users/user/:id` (`getUserInfoById`). Feeds
 * `src/app/(main)/profile/[id]/page.jsx` and
 * `src/app/(main)/users/profile/[id]/page.jsx`, which both render `Profile.jsx`.
 *
 * WHY THIS EXISTS RATHER THAN REUSING `PUBLIC_MEMBER_ITEM`. The two anonymous
 * reads are NOT the same surface and the earlier single-projection version was
 * assessed against only one of them:
 *
 *   - `/users/member` is the HARVEST surface. One anonymous call returns EVERY
 *     member's row at once, so it is a bulk export and must be minimal.
 *   - `/users/user/:id` is a DISPLAY surface. One anonymous call returns ONE
 *     member, to a caller who already had to supply an id, and its job is to
 *     render that member's public profile page.
 *
 * Reusing the directory projection here silently broke the profile page: the
 * components read fields it does not provide, and the affected UI disappears
 * rather than erroring, so the regression would only have been visible after
 * cutover. The re-admitted fields are exactly the display-only ones the
 * profile page renders and the CARD does not:
 *
 *   - `coverImage` — `ProfileID.jsx:11-12` renders it as the profile's cover
 *     banner. Without it the banner falls back to the gradient and the member's
 *     chosen header image vanishes.
 *   - `skills`     — `SkillsSection.jsx:10,26` renders the whole Skills
 *     SECTION from it (`Profile.jsx:782` maps it into `skillGroups`). Without
 *     it the entire section collapses to its "No skills listed yet" empty state,
 *     which is indistinguishable from a member who genuinely has no skills.
 *   - `createdAt`  — the "Member since" row, `ProfileHero.jsx:93`, fed from
 *     `Profile.jsx:763`. Without it the row rendered as a broken
 *     "Member since " with an empty date. See the dedicated `createdAt` note
 *     below for why this one is safe to publish.
 *   - (`roles.positionName` is a fourth candidate, and it is DELIBERATELY NOT
 *     admitted — see the long note immediately below.)
 *
 * `email` and `phone` are NOT re-admitted even though `ProfileHero.jsx:16`,
 * `ContactSection.jsx:12-13` and `MemberInfoSection.jsx:13` do read them. Both
 * degrade to a hidden/`—` row rather than breaking, and the field-usage
 * assessment is explicit that a `mailto:` is not worth the contact disclosure
 * the directory finding was about.
 *
 * ================= WHY `roles.positionName` IS NOT ADMITTED =================
 * `ProfileID.jsx:29` and `Profile.jsx:758,765` do read
 * `user?.roles?.positionName`, so re-admitting it looks free. IT IS NOT, and
 * this was verified rather than assumed:
 *
 *   - `positionName` is NOT an independent human label. `admin.controller.js:225`
 *     writes `positionName: positionName?.trim() || role` — when an admin grants a
 *     role without supplying a display name, the label IS the role string.
 *   - `admin.controller.js:409` constructs new admin-created members as
 *     `roles: { role, position: 0, positionName: role }` — identical again.
 *   - `user.model.js:196` defaults the whole sub-document to
 *     `{ role: 'member', position: 0, positionName: 'member' }` — identical
 *     again, by default, for every account that never had a role assigned.
 *
 * So `positionName` is a COPY of the authorising enum in every construction path
 * this codebase has, and `adminAuth.js:38` authorises the entire admin surface on
 * `user.roles.role` against `adminRoles = ['admin', 'moderator', 'mentor']`.
 * Projecting `roles.positionName` on an anonymous read would therefore publish
 * the literal strings `admin`, `moderator` and `mentor` for exactly the accounts
 * that hold panel access — the identical ranked target list that excluding
 * `roles` was the whole point of this file. A field cannot be re-admitted on the
 * strength of it being "only a display label" when the code that writes it
 * defaults it to the secret.
 *
 * THE VISIBLE COST, accepted knowingly: a public profile's position line falls
 * back to its own literal ("CPCCU Member" / "Member") instead of the member's
 * club office. That is the same trade the directory listing already makes, and
 * it is the correct one — a club office is not worth publishing a
 * credential-stuffing target list for.
 *
 * WHAT ELSE IS STILL EXCLUDED, unchanged from `PUBLIC_MEMBER_ITEM` and for the
 * same reasons stated there: `email`, `phone`, `uniID`, `isValid`, `roles` (whole
 * sub-document), `avatarPublicId`, `coverImagePublicId`, `socialLinks`,
 * `jobPipelineTitle`, `jobPipelineRejectionReason`, `updatedAt`.
 *
 * --------------------- `createdAt` — ADDED TO THIS PROJECTION --------------
 * `createdAt` is the one field this projection has in common with
 * `PUBLIC_MEMBER_ITEM` that it DELIBERATELY now admits where the directory does
 * not, so the difference is called out rather than left to be discovered.
 *
 * It is the ACCOUNT-CREATION timestamp. Mongoose sets it on insert, so it is
 * not user-supplied, not editable through any route in this app, and not a
 * credential, a contact detail or an identifier.
 *
 * WHY IT IS SAFE TO PUBLISH. It is the input to exactly one rendered row — the
 * "Member since" line, `ProfileHero.jsx:93`, fed from
 * `user.createdAt` via `Profile.jsx:763` (and `joinDate` at `:764`, which
 * `MemberInfoSection.jsx:11` also displays). Exposing it reveals nothing beyond
 * what the profile already shows: a profile page is a per-member DISPLAY
 * surface, the caller already had to supply a specific id to get it (see the
 * harvest-vs-display argument above), and the field discloses no capability.
 * Without it the row rendered as a broken "Member since " with an empty date.
 *
 * WHY IT IS NOT ADDED TO `PUBLIC_MEMBER_ITEM`. The directory CARD renders no
 * date at all (`AboutCard.jsx:19-44`), so on the HARVEST surface this field
 * would grow the largest anonymous response in the app for zero display value.
 * The two projections are maintained separately on purpose — see the note on
 * intentional duplication below.
 *
 * THE DUPLICATION IS INTENTIONAL. The two strings are listed separately rather
 * than composed (`PUBLIC_MEMBER_ITEM + ' coverImage skills'`) because a
 * concatenation would make each constant's contents unreadable at the point of
 * use, and — more importantly — because the invariants above are per-surface. If
 * a field is ever added to one, it must be re-assessed against the OTHER
 * consumer's reason for excluding it, which a shared string would hide.
 */
export const PUBLIC_PROFILE_ITEM =
  '_id fullName avatar coverImage bio department section batch github linkedin portfolio jobPipelineStatus skills createdAt';

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
