import {
  createAdminCertificate,
  listAdminCertificates,
} from '@/lib/server/controllers/adminContent.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET|POST /api/v1/admin/certificates` — every issued certificate, and the
 * issue endpoint. Two methods, one file.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js`. Omitting it does not make the route
 * public — auth is the default — but it removes every per-action check, so any
 * authenticated member could read or issue certificates. Certificates are the
 * most consequential documents this API can produce (they are what
 * `/verify/[certificateId]` and the public verification endpoint resolve), which
 * is why the flag is read explicitly on this file rather than assumed.
 * `adminAuth.js` fails closed, so the omission is the recoverable direction.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/certificates')` gives
 * `path === '/certificates'`, `resource === null`, `isUpload === false`.
 * `/certificates` is the THIRD entry in `mentorReadPaths`:
 *   GET  — `admin` allow; `moderator` allow via `isReadOnly`; `mentor` allow.
 *   POST — `moderator` DENY (not a read, not `/content/…`, not the upload path)
 *          and `mentor` DENY. Issuing a certificate is ADMIN-ONLY.
 *
 * PRESERVED: the GET is UNPAGINATED AND UNFILTERED — no `.skip()`, no
 * `.limit()`, no projection. It is the only unbounded read in this controller
 * and it is preserved as written because the certificate count is itself a
 * dashboard tile and the panel's table assumes it can see them all. Adding a
 * limit would change the response the panel renders, not just its performance.
 *
 * The two handlers use the `ApiResponse` envelope (envelope #1 in
 * `response.js`), NOT the `{ success, data }` shape the PUBLIC certificate
 * endpoints use. The distinction is preserved deliberately; do not "align" the
 * two.
 *
 * SEGMENT DISJOINTNESS: one static segment below the mount, so the
 * two-segment `certificates/[id]` sibling cannot serve it, and no catch-all
 * exists under `src/app/api/v1/admin/`.
 */

// `nodejs` because these routes reach `mongoose`, which is not Edge-compatible.
// `force-dynamic` because they read the auth cookie and the database, and must
// never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  admin: true,
  controller: listAdminCertificates,
});

export const POST = defineRoute('POST', {
  admin: true,
  controller: createAdminCertificate,
});
