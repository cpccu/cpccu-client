import {
  createAdminMember,
  getAdminMembers,
} from '@/lib/server/controllers/admin.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET|POST /api/v1/admin/members` — the admin Members table, and the
 * "add member" path that BYPASSES registration. Two methods, one file.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js`. A route that forgets the flag is not
 * public — auth is the default — but it performs NO per-action authorisation, so
 * any authenticated member could list every member and create new accounts.
 * `adminAuth.js` fails closed, so that omission is the recoverable direction;
 * the unrecoverable direction (a hardcoded `resource`) is structurally
 * impossible because nothing in this composition can supply one.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/members')` gives
 * `path === '/members'`, `resource === null`, `isUpload === false`. `/members`
 * is the SECOND entry in `mentorReadPaths`, and it is a real prefix match, so
 * the two methods land differently:
 *   GET  — `admin` allow; `moderator` allow via `isReadOnly`; `mentor` allow
 *          (GET + `/members` prefix). A mentor CAN read the member list.
 *   POST — `moderator` DENIED (not a read, not `/content/…`, not the upload
 *          path) and `mentor` DENIED. Member creation is ADMIN-ONLY.
 * The GET is safe for a mentor to read in the sense that matters: it is projected
 * through `PUBLIC_ITEM`, which excludes `password` and `refreshTokens`, so no
 * member's credential material is exposed on a path a mentor can reach. It does
 * still expose `uniID` and `roles`.
 *
 * PRESERVED BUSINESS RULES on the POST that a reader must not mistake for
 * defects: an admin-created member is created `isValid: true` (immediately able
 * to log in, where registration creates `isValid: false` and requires an OTP),
 * and the password is NOT run through `validatePasswordStrength`, so the 8+
 * character policy does not apply — an admin can create a one-character
 * password. `role` defaults to `'member'`, the lowest privilege grantable. All
 * original, all in `admin.controller.js`.
 *
 * SEGMENT DISJOINTNESS: `members` is one static segment below the mount, so the
 * two-segment `members/[id]` sibling cannot serve it, and no catch-all exists
 * under `src/app/api/v1/admin/`. `roles/active` is the only place in this router
 * where a static segment had to be pulled out from under a same-depth `[id]`,
 * and that is a different first segment, so neither route shadows the other.
 */

// `nodejs` because these routes reach `mongoose` and `bcryptjs`, neither of
// which is Edge-compatible. `force-dynamic` because they read the auth cookie
// and the database, and must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  admin: true,
  controller: getAdminMembers,
});

export const POST = defineRoute({
  method: 'POST',
  admin: true,
  controller: createAdminMember,
});
