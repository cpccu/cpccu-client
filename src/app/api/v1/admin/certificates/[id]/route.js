import {
  deleteAdminCertificate,
  updateAdminCertificate,
} from '@/lib/server/controllers/adminContent.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH|DELETE /api/v1/admin/certificates/:id` — correct or revoke one issued
 * certificate. Two methods, one file.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js`. Omitting it does not make the route
 * public — auth is the default — but it removes every per-action check, so any
 * authenticated member could rewrite or delete a certificate. `adminAuth.js`
 * fails closed, so the omission is the recoverable direction.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/certificates/<id>')` gives
 * `path === '/certificates/<id>'`, `resource === null`, `isUpload === false`.
 * Both verbs are ADMIN-ONLY. A moderator fails `isReadOnly`; a mentor fails the
 * method test — and note `/certificates` IS a `mentorReadPaths` entry, so for a
 * mentor it is again the METHOD that denies. `mentorReadPaths` is a read
 * allowlist, never a write guard, and must not be cited as one.
 *
 * AUTHORISING THE ACTION IS NOT AUTHORISING THE TARGET: `authorizeAdminAction`
 * says "an admin may edit a certificate", never which one. The DELETE here is a
 * HARD delete — the document is what `/verify/[certificateId]` and the public
 * verification endpoint resolve, so a delete is a real revocation and there is no
 * `deletedAt` tombstone to fall back on.
 *
 * SEGMENT DISJOINTNESS: one dynamic segment below a static `certificates`,
 * disjoint from the one-segment `certificates` file by depth and from
 * `roles/[id]`, `members/[id]` and `contributors/[githubUsername]` by first
 * segment. It is two segments deep, so it cannot be reached by — or reach — the
 * three-segment `content/[resource]/[id]`. No catch-all exists anywhere under
 * `src/app/api/v1/admin/`, so no URL is claimed by two files.
 */

// `nodejs` because these routes reach `mongoose`, which is not Edge-compatible.
// `force-dynamic` because they read the auth cookie and the database, and must
// never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute({
  method: 'PATCH',
  admin: true,
  controller: updateAdminCertificate,
});

export const DELETE = defineRoute({
  method: 'DELETE',
  admin: true,
  controller: deleteAdminCertificate,
});
