import {
  getAdminSystemSettings,
  updateAdminSystemSettings,
} from '@/lib/server/controllers/adminContent.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET|PATCH /api/v1/admin/system-settings` — the single `key: 'system'`
 * settings document every page may read. Two methods, one file.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js`. Omitting it does not make the route
 * public — auth is the default — but it drops every per-action check, so any
 * authenticated member could rewrite the settings document the whole site reads.
 * `adminAuth.js` fails closed, so that omission is the recoverable direction.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/system-settings')` gives
 * `path === '/system-settings'`, `resource === null`, `isUpload === false`.
 * Note that `/system-settings` is NOT in `mentorReadPaths`, so:
 *   GET  — `admin` allow; `moderator` allow via `isReadOnly`; `mentor` DENY.
 *          A mentor cannot read the settings even though they can read
 *          `/members` and `/certificates`. The prefix list is not "all
 *          read-only admin routes", it is a short, explicit set.
 *   PATCH — `moderator` DENY (not a read, not `/content/…`, not the upload path)
 *            and `mentor` DENY. Settings writes are ADMIN-ONLY.
 *
 * ===================== PRESERVED: THIS GET WRITES TO THE DATABASE =====================
 * `getAdminSystemSettings` is `SystemSettings.findOneAndUpdate({ key: 'system' },
 * { $setOnInsert: { key: 'system' } }, { new: true, upsert: true })` — a
 * GET-OR-CREATE. The `$setOnInsert` means it never overwrites settings an admin
 * has already saved, but it IS a write on a read endpoint, which is what makes a
 * read-only replica refuse it and what would make any cache of this response
 * wrong. It is preserved because it is also what removes the need for a seed
 * script or a "not configured" branch in the panel. `Cache-Control: no-store` is
 * set unconditionally by `http.js`, so no platform cache can hold it either way.
 *
 * PRESERVED: the PATCH is `{ $set: req.body }` — UNFILTERED, with no allowlist
 * and no `runValidators`. Any field the `SystemSettings` schema declares can be
 * set; a field it does not declare is dropped by Mongoose's strict mode rather
 * than rejected. `upsert: true` means a PATCH on a not-yet-created settings
 * document CREATES it, so the panel need not call the GET first. Original
 * behaviour, documented in the controller; do not add a filter here without a
 * product decision, and note that adding one would change what the panel can
 * save.
 *
 * SEGMENT DISJOINTNESS: one static segment below the mount, so nothing at
 * `[id]` depth can reach it, and there is no catch-all under
 * `src/app/api/v1/admin/`.
 */

// `nodejs` because these routes reach `mongoose`, which is not Edge-compatible.
// `force-dynamic` because they read the auth cookie and the database, and
// because the GET performs an upsert — it must never be prerendered, and a
// build-time prerender would write to the database.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  admin: true,
  controller: getAdminSystemSettings,
});

export const PATCH = defineRoute('PATCH', {
  admin: true,
  controller: updateAdminSystemSettings,
});
