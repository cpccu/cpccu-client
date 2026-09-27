import { getAdminStatistics } from '@/lib/server/controllers/adminContent.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/admin/statistics` — the site-wide counters for the admin
 * dashboard, computed live from the real data sources (members, gallery, events,
 * visitor counter, certificates, certificate-verification logs). Nothing on this
 * endpoint is editable.
 *
 * It deliberately calls the SAME service as the public statistics endpoint
 * (`content.controller.js`'s `getPublicStatistics`), so the public counter and
 * the admin one cannot disagree — a visible inconsistency on a dashboard is worse
 * than the small extra cost of computing both from one source.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js`. Omitting it leaves the route
 * authenticated but with no per-action check. `adminAuth.js` fails closed, so
 * that omission is the recoverable direction.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/statistics')` gives
 * `path === '/statistics'`, `resource === null`, `isUpload === false`.
 * `/statistics` is the FOURTH entry in `mentorReadPaths` and is matched as a real
 * PREFIX, so a mentor is allowed here. That prefix match is intentional in the
 * original (`adminAuth.js` documents that it "intentionally also covers
 * `/statistics/2024`") — do not tighten it to an equality test, which would
 * silently remove mentor read access that the Express build granted.
 * `moderator` → allow via `isReadOnly`. `member` / anonymous → stopped earlier
 * (403 "Admin access is required" / 401).
 *
 * ============================ DISJOINT FROM `content` ============================
 * THIS ROUTE IS TWO SEGMENTS BELOW THE MOUNT (`statistics`) and
 * `content/[resource]` is ALSO two — but the FIRST segment is static here and
 * dynamic there, and the two can never both match a URL: `/api/v1/admin/statistics`
 * has `statistics` where `content/[resource]` requires the literal `content`.
 * That is the same shadowing the Express original relied on, where
 * `/statistics` was registered before `/content/:resource` and shadowed it
 * identically. `/content/statistics` remains reachable through the generic
 * resource path (and is not in the admin `getModel` whitelist, so it 404s there
 * — see the sibling file's note). There is NO catch-all under
 * `src/app/api/v1/admin/`: one here would have to re-implement the moderator and
 * mentor resource derivation by hand, which is the single most likely way to
 * accidentally grant access, so the router is enumerated instead.
 *
 * A PURE READ — unlike the role endpoints and `/system-settings`, this GET
 * performs no writes.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads the auth cookie and the database, and must
// never be prerendered into a static statistics payload at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  admin: true,
  controller: getAdminStatistics,
});
