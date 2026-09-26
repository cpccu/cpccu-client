import { toggleAdminRole } from '@/lib/server/controllers/adminRole.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH /api/v1/admin/roles/:id/toggle` — flip a position's `active` flag.
 *
 * The one-segment-deeper sibling of `roles/[id]`, and therefore NOT reachable
 * from it: `roles/[id]` matches exactly two segments below the mount, so a
 * three-segment path can never be served by it, and the only three-segment path
 * under `roles/` is this one. There is no static sibling to shadow and no
 * catch-all, so `id` here is always a real id — unlike `roles/active`, where the
 * static file had to win over a `[id]`.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full note is in
 * `src/app/api/v1/admin/roles/route.js`. Omitting it leaves the route
 * authenticated but with no per-action authorisation, i.e. any logged-in member
 * could flip roles. `adminAuth.js` fails closed, so that is the recoverable
 * direction of the mistake.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/roles/<id>/toggle')` gives
 * `path === '/roles/<id>/toggle'`, `resource === null`, `isUpload === false`.
 * `admin` → allow; `moderator` → DENY (a `PATCH` is not `isReadOnly`, and the
 * path is not `/content/…` nor the upload path); `mentor` → DENY (wrong method
 * and no `mentorReadPaths` prefix). The extra `/toggle` segment does not
 * participate in any allowlist test at all — it is only part of `path`, and
 * nothing in `adminAuth.js` matches on it.
 *
 * ================= PRESERVED: THE TOGGLE IS READ-THEN-WRITE =================
 * `toggleAdminRole` is `findById` → `role.active = !role.active` → `save()`, NOT
 * an atomic `$set` of the negation. Two concurrent toggles of the same role both
 * read the same starting value, both write the same opposite value, and ONE
 * INTENDED FLIP IS LOST. The atomic form would be a single
 * `findByIdAndUpdate(id, { $set: { active: { $not: … } } })` or a pipeline
 * update. This is original behaviour and is preserved rather than fixed,
 * because the atomic version changes what the response document carries. The
 * panel issues one toggle at a time per role, which is why it has never surfaced.
 * If this is ever made atomic, this comment is the place to say so.
 *
 * Also preserved: a malformed `id` throws a Mongoose `CastError` and becomes a
 * 500 rather than the 404 a missing role produces, because `findById` is the only
 * validation of `id` on this path.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads the auth cookie and the database, and must
// never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute({
  method: 'PATCH',
  admin: true,
  controller: toggleAdminRole,
});
