import {
  createAdminRole,
  getAdminRoles,
} from '@/lib/server/controllers/adminRole.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET|POST /api/v1/admin/roles` — the CPCCU position catalogue ("President",
 * "Treasurer", …), and the create endpoint for it. Two methods, one file.
 *
 * ============================================================================
 * `admin: true` ON EVERY FILE IN THIS ROUTER — AND WHY IT IS A PER-FILE FLAG
 * ============================================================================
 * In Express ONE LINE covered the entire admin surface:
 *
 *     router.use(verifyToken, requireAdmin, authorizeAdminAction);
 *                                                    // admin.route.js:41
 *
 * App Router has no equivalent. There is no route-group-level middleware and no
 * `route.js` that can wrap a DIRECTORY: a `route.js` is the only unit, and
 * `defineRoute` / `apiRoute` know nothing about "this folder is protected". So
 * that single `router.use` becomes `admin: true` on each of the 24 files under
 * `src/app/api/v1/admin/`, declared once per endpoint.
 *
 * THE OMISSION IS SILENT, AND IT IS THE ONE HAZARD SPECIFIC TO THIS PHASE.
 * A route file that forgets `admin: true` is NOT public — authentication is the
 * DEFAULT in `apiRoute`, so it is still gated by `verifyToken` — but it performs
 * NO per-action authorisation at all. It reads as "authenticated" in review,
 * passes a smoke test driven by a logged-in member, and ships a live endpoint
 * that any member (or any mentor, or any moderator) may call. Nothing warns,
 * because there is no router-level default left to fall back on. The only
 * defence is that the flag is read on every one of these files.
 *
 * WHAT MAKES THAT RECOVERABLE, AND WHY IT MATTERS: `adminAuth.js` FAILS CLOSED.
 * `requireAdminAction` throws `ApiError(403, …)` for anything not positively
 * allowed, and `describeAdminRoute` derives the resource from the path rather
 * than accepting one from the caller. So the ONE mistake this flag can make is
 * the recoverable direction (a public endpoint, loud and obviously wrong in
 * review and in production logs), and the mistakes it CANNOT make — a wrong
 * resource, a wrongly-derived mount-relative path — are structurally impossible.
 * A fail-OPEN design would make a forgotten flag the dangerous direction.
 *
 * THE CHAIN `admin: true` WIRES, in order (`src/lib/server/http.js`):
 *   `verifyToken(request)`        -> a real principal, or 401
 *   `requireAdmin(user)`          -> `roles.role` ∈ {admin, moderator, mentor};
 *                                    `member` is refused here with 403
 *                                    "Admin access is required", because a role
 *                                    an admin may GRANT is not a role that grants
 *                                    panel access
 *   `authorizeAdminAction(...)`   -> may THIS role perform THIS method on THIS
 *                                    path? (the role matrix below)
 *
 * AUTHORISING THE ACTION IS NOT THE SAME AS AUTHORISING THE TARGET. The third
 * step answers "may a moderator write here?", and knows nothing about what will
 * be written or to which collection — that is `getModel()`'s whitelist in
 * `adminContent.controller.js`, reached through the `:resource` URL segment.
 * Conversely `getModel` does not know who is calling, and a moderator is refused
 * on a resource outside `moderatorResources` before any query is built. BOTH are
 * required and NEITHER substitutes for the other: drop `admin: true` and the
 * whitelist is still the only thing between an authenticated member and
 * `PATCH /api/v1/admin/content/<resource>/<id>`; drop the whitelist and the role
 * matrix is still the only thing between a moderator and `profiles`.
 *
 * ================================ THE ROLE MATRIX ================================
 * Documented in `cpccu-server/docs/API_REFERENCE.md` ("Permission matrix
 * (admin)") and, in the code that implements it, in `adminAuth.js`'s own
 * comments. `adminAuth.js` has ZERO TEST COVERAGE in the original Express
 * backend, and the matrix below was RE-DERIVED THREE TIMES during this migration
 * — from the middleware source, from the API reference, and from
 * `describeAdminRoute`'s own output — before it was confirmed to agree with all
 * three. Any change to role behaviour (adding a role to `adminRoles`, to
 * `moderatorResources`, to `mentorReadPaths`, or changing which files carry
 * `admin: true`) invalidates that agreement: RE-CHECK THE WHOLE TABLE, because a
 * matrix error in either direction is silent — a wrong denial looks like "the
 * moderator cannot save posts" and a wrong grant looks like nothing at all.
 *
 *   route                                    admin   moderator   mentor
 *   GET  /admin/roles                        allow    allow(GET)  deny
 *   POST /admin/roles                        allow    deny        deny
 *   GET  /admin/roles/active                 allow    allow(GET)  deny
 *   PATCH /admin/roles/:id                   allow    deny        deny
 *   PATCH /admin/roles/:id/toggle            allow    deny        deny
 *   GET  /admin/overview                     allow    allow(GET)  allow
 *   POST /admin/uploads/image                allow    ALLOW       deny
 *   GET  /admin/members                      allow    allow(GET)  allow
 *   POST /admin/members                      allow    deny        deny
 *   PATCH|DELETE /admin/members/:id          allow    deny        deny
 *   GET  /admin/statistics                   allow    allow(GET)  allow
 *   GET  /admin/system-settings              allow    allow(GET)  deny
 *   PATCH /admin/system-settings             allow    deny        deny
 *   GET  /admin/certificates                 allow    allow(GET)  allow
 *   POST /admin/certificates                 allow    deny        deny
 *   PATCH|DELETE /admin/certificates/:id     allow    deny        deny
 *   GET  /admin/content/:resource            allow    allow(GET)  deny
 *   POST /admin/content/:resource            allow    only for `events`, `gallery`,
 *                                                   `posts`, `gallery-events`
 *   PATCH|DELETE /admin/content/:resource/:id  same as the POST above
 *   GET  /admin/contributors                 allow    allow(GET)  deny  (see the
 *                                                   stale-comment note in that file)
 *   PATCH /admin/contributors/:githubUsername  allow   deny        deny
 *
 * ============== WHY THE PATHNAME REACHES `adminAuth` UNREWRITTEN ==============
 * `authorizeAdminAction` derives its entire routing context from
 * `request.nextUrl.pathname` (`http.js:pathnameOf`), and the derivation is
 * MOUNT-RELATIVE: `describeAdminRoute` strips the literal prefix
 * `/api/v1/admin` and computes `path`, `resource` and `isUpload` from the
 * remainder. So this file only authorises correctly because the pathname that
 * arrives is the REAL, ABSOLUTE, UNREWRITTEN one — `/api/v1/admin/roles`, never
 * a relative `/roles`, never a trailing-slashed variant, and never a rewritten
 * alias. Three things guarantee that today, and all three must hold:
 *   - `next.config.mjs` declares NO `rewrites`/`redirects` that touch `/api`;
 *   - `src/proxy.ts` returns a bare `NextResponse.next()` and rewrites nothing;
 *   - `http.js`'s `pathnameOf` falls back to parsing `request.url` when
 *     `nextUrl` is absent, so a plain-`Request` test sees the same path.
 * IF ANY OF THAT CHANGED, the failure is SILENT AND ONE-SIDED: a stripped or
 * rewritten pathname yields `resource: null` and a non-matching `path`, so every
 * MODERATOR write is denied with a bare 403 — "moderators cannot save posts" —
 * while ADMINS are entirely unaffected, because `role === 'admin'` returns true
 * before any of it is consulted. A one-line change in `next.config.mjs` can
 * therefore remove moderator functionality without producing a single error.
 *
 * NOTHING IN THE ADMIN SURFACE IS `public: true`. Every file under
 * `src/app/api/v1/admin/` is authenticated by the ABSENCE of `public: true` and
 * additionally role-gated by `admin: true`; the two are independent and neither
 * implies the other.
 *
 * ================= THIS ENDPOINT WRITES ON A READ — PRESERVED =================
 * `getAdminRoles` calls `seedDefaultRoles()` before it queries: ten sequential
 * `findOneAndUpdate({ slug }, …, { upsert: true })` writes on EVERY GET. That is
 * original behaviour (a self-healing catalogue rather than a migration), and it
 * is preserved here — the migration does not change what a controller does. It
 * does mean this GET is not `GET`-safe, is not cacheable, and would be rejected
 * by a read-only replica. `Cache-Control: no-store` is already unconditional on
 * every response from `http.js`, so nothing here is at risk of being cached.
 * The same ten writes are behind `GET /api/v1/admin/roles/active`.
 */

// `nodejs` because these routes reach `mongoose`, which is not Edge-compatible.
// `force-dynamic` because they read the auth cookie and the database, and must
// never be prerendered or cached — which also matters here because GET performs
// writes (see the seeding note above).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  admin: true,
  controller: getAdminRoles,
});

export const POST = defineRoute('POST', {
  admin: true,
  controller: createAdminRole,
});
