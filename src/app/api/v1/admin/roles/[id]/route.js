import { updateAdminRole } from '@/lib/server/controllers/adminRole.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH /api/v1/admin/roles/:id` — rename a position, switch it on/off, or
 * both in one call.
 *
 * The catalogue here is a set of DISPLAY names for club positions; it is NOT the
 * privilege model. Authorisation comes from the `roles.role` enum on the user
 * document (`adminAuth.js`), so creating or renaming a `Role` document named
 * "Treasurer" grants nobody anything. Do not wire these endpoints into the auth
 * decision.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); see the full note in
 * `src/app/api/v1/admin/roles/route.js`. Omitting it does not make the route
 * public — auth is the default — but it removes every per-action check, so any
 * authenticated member could rename roles. `adminAuth.js` fails closed, so that
 * omission is the recoverable direction.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/roles/<id>')` gives
 * `path === '/roles/<id>'`, `resource === null`, `isUpload === false`. Only
 * `admin` is allowed: a moderator fails the `isReadOnly` test (this is a
 * `PATCH`) and a mentor fails both the method test and the `mentorReadPaths`
 * prefix test. Note that the DERIVED `path` contains the id, so the mentor
 * prefix test is a `startsWith` on `/roles/...` — which matches no entry in
 * `mentorReadPaths` regardless of the id, and so is a denial, not a near-miss.
 *
 * THIS SEGMENT IS DISJOINT FROM EVERY OTHER `[id]` IN THE ADMIN ROUTER, and it is
 * worth stating why rather than leaving it to segment counting: this file is
 * two segments below the mount (`roles/<id>`) with a STATIC first segment, while
 * `content/[resource]/[id]` is two segments with a DYNAMIC first segment and
 * three segments below its own `[resource]`, and `members/[id]`,
 * `certificates/[id]` and `contributors/[githubUsername]` are one segment with
 * their own static first segment. Distinct first segments cannot be matched by
 * the same file; equal depths with different first segments cannot be shadowed.
 * There is NO catch-all anywhere under `src/app/api/v1/admin/`, which is what
 * makes that true by construction rather than by convention.
 *
 * PRESERVED BEHAVIOUR worth knowing before changing anything here:
 *  - renaming RECOMPUTES the slug and performs NO duplicate check (unlike
 *    `createAdminRole`), so a rename that collides surfaces as the unique
 *    index's `E11000` (a 500) rather than a 409;
 *  - `Boolean(active)` COERCES, so a panel that sends the string `"false"`
 *    switches the role ON.
 * Both are original and are documented in `adminRole.controller.js`.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads the auth cookie and the database, and must
// never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute({
  method: 'PATCH',
  admin: true,
  controller: updateAdminRole,
});
